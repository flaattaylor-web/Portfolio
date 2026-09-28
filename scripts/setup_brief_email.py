#!/usr/bin/env python3
"""Interactive setup for the Monday Brief's unattended email.

Run this once, on your own machine:

    python scripts/setup_brief_email.py

It prompts for the Gmail app password (hidden input), checks it by logging in
to Gmail's SMTP server, encrypts it with the repository's public key, and
stores it as the GMAIL_APP_PASSWORD Actions secret. It also sets the BRIEF_FROM
and BRIEF_TO repository variables, which are not secret and stay readable and
editable in the GitHub UI.

The password is never echoed, never written to disk, and never sent anywhere
except to GitHub, sealed-box encrypted, and to Gmail's SMTP server as a login.

    --check   report what is configured now and exit, prompting for nothing
    --test    after storing, trigger a workflow run that emails the issue

Requires PyNaCl for the sealed-box encryption GitHub mandates for secrets; the
script offers to pip install it if it is missing. Everything else is standard
library.
"""
import argparse
import getpass
import json
import os
import re
import smtplib
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"
SECRET_NAME = "GMAIL_APP_PASSWORD"
WORKFLOW = "monday-brief.yml"
SMTP_HOST, SMTP_PORT = "smtp.gmail.com", 465


# ---------------------------------------------------------------- plumbing

def die(msg, hint=""):
    print(f"\n  {msg}", file=sys.stderr)
    if hint:
        print(f"  {hint}", file=sys.stderr)
    sys.exit(1)


SCOPE_HELP = (
    "The token needs permission for Actions secrets and variables.\n"
    "  Classic token: tick the whole `repo` scope.\n"
    "  Fine-grained token: on this repository, set Secrets, Variables and\n"
    "  Actions each to Read and write.")


def call(method, path, token, payload=None, quiet=()):
    """quiet holds status codes to return instead of aborting."""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "monday-brief-setup"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return r.status, (json.loads(body) if body.strip() else {})
    except urllib.error.HTTPError as e:
        if e.code in quiet:
            return e.code, {}
        detail = ""
        try:
            detail = json.loads(e.read()).get("message", "")
        except Exception:
            pass
        if e.code in (401, 403):
            die(f"GitHub refused the token ({e.code} {detail}).", SCOPE_HELP)
        # Never let a token reach the terminal via an exception string.
        raise SystemExit(f"\n  GitHub API {method} {path} failed: {e.code} {detail}")


def detect_repo():
    """owner/name from the git remote, so the script works from any clone."""
    try:
        url = subprocess.run(["git", "remote", "get-url", "origin"],
                             capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        return None
    m = re.search(r"github\.com[:/]+([^/]+)/(.+?)(?:\.git)?$", url)
    return f"{m.group(1)}/{m.group(2)}" if m else None


def require_tty(what):
    """Hidden input needs a console. Without one, getpass would block forever,
    so say what to do instead."""
    if not sys.stdin.isatty():
        die(f"cannot prompt for {what}: this is not an interactive terminal.",
            "Run the script directly in a terminal, or for the token set\n"
            "  GITHUB_TOKEN in the environment first. The app password can only\n"
            "  be entered interactively, by design.")


def find_token():
    for var in ("GITHUB_TOKEN", "GH_TOKEN"):
        if os.environ.get(var):
            return os.environ[var], f"${var}"
    try:
        out = subprocess.run(["gh", "auth", "token"], capture_output=True,
                             text=True, timeout=30)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip(), "gh auth token"
    except (OSError, subprocess.SubprocessError):
        pass
    require_tty("a GitHub token")
    print("\n  Needs a GitHub token with repo scope (Settings -> Developer settings")
    print("  -> Personal access tokens). Input is hidden.")
    tok = getpass.getpass("  GitHub token: ").strip()
    return (tok, "typed") if tok else die("no token given")


def need_pynacl():
    try:
        from nacl import encoding, public          # noqa: F401
        return True
    except ImportError:
        pass
    print("\n  PyNaCl is needed to encrypt the secret (GitHub requires sealed-box")
    print("  encryption; there is no plaintext upload path).")
    if input("  Install it now with pip? [y/N] ").strip().lower() not in ("y", "yes"):
        die("cannot continue without PyNaCl",
            f"install it yourself: {sys.executable} -m pip install pynacl")
    r = subprocess.run([sys.executable, "-m", "pip", "install", "pynacl"])
    if r.returncode != 0:
        die("pip install pynacl failed")
    return True


def seal(public_key_b64, secret_value):
    from nacl import encoding, public
    key = public.PublicKey(public_key_b64.encode(), encoding.Base64Encoder())
    return encoding.Base64Encoder().encode(
        public.SealedBox(key).encrypt(secret_value.encode())).decode()


# ---------------------------------------------------------------- actions

UNREADABLE = object()          # distinct from "not set"


def read_state(repo, token):
    status, sec = call("GET", f"/repos/{repo}/actions/secrets/{SECRET_NAME}", token,
                       quiet=(403, 404))
    out = {"secret": UNREADABLE if status == 403 else sec.get("updated_at")}
    for name in ("BRIEF_FROM", "BRIEF_TO"):
        status, var = call("GET", f"/repos/{repo}/actions/variables/{name}", token,
                           quiet=(403, 404))
        out[name] = UNREADABLE if status == 403 else var.get("value")
    return out


def describe(value, set_text):
    if value is UNREADABLE:
        return "cannot read - token lacks the Actions scope"
    return set_text(value) if value else "NOT SET"


def show(state):
    print(f"\n  {SECRET_NAME:18s} "
          + describe(state["secret"], lambda v: f"set, updated {v}"))
    for name in ("BRIEF_FROM", "BRIEF_TO"):
        print(f"  {name:18s} " + describe(state[name], lambda v: v))
    if any(v is UNREADABLE for v in state.values()):
        print("\n  " + SCOPE_HELP.replace("\n", "\n  "))


def put_variable(repo, token, name, value):
    status, _ = call("POST", f"/repos/{repo}/actions/variables", token,
                     {"name": name, "value": value}, quiet_404=True)
    if status not in (201,):
        call("PATCH", f"/repos/{repo}/actions/variables/{name}", token,
             {"name": name, "value": value})


def verify_smtp(sender, password):
    """Log in to Gmail before storing, so a bad password fails here and not
    silently inside a Monday morning Actions run."""
    print("  checking the password against Gmail ... ", end="", flush=True)
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT,
                              context=ssl.create_default_context(), timeout=45) as s:
            s.login(sender, password)
    except smtplib.SMTPAuthenticationError:
        print("rejected")
        die("Gmail rejected that address and password.",
            "App passwords need 2-Step Verification on, and are generated at\n"
            "  https://myaccount.google.com/apppasswords - not your normal password.")
    except (OSError, smtplib.SMTPException) as e:
        print("could not check")
        die(f"could not reach Gmail SMTP: {type(e).__name__}",
            "Check your network, then re-run. Nothing has been stored.")
    print("accepted")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", help="owner/name (default: from the git remote)")
    ap.add_argument("--check", action="store_true", help="report and exit")
    ap.add_argument("--test", action="store_true",
                    help="trigger a workflow run that emails the issue")
    args = ap.parse_args()

    repo = args.repo or detect_repo() or die("could not work out the repository",
                                             "pass --repo owner/name")
    token, origin = find_token()
    print(f"\n  repository  {repo}\n  token       {origin}")

    state = read_state(repo, token)
    show(state)
    if args.check:
        return 0

    # A value the token could not read is no basis for a default.
    known = {k: (None if v is UNREADABLE else v) for k, v in state.items()}

    require_tty("the app password")
    print("\n  Press Enter to keep a current value shown in brackets.")
    sender = input(f"\n  Gmail address to send from [{known['BRIEF_FROM'] or ''}]: ").strip() \
        or known["BRIEF_FROM"] or die("a sender address is required")
    recipients = input(f"  Recipients, comma separated [{known['BRIEF_TO'] or ''}]: ").strip() \
        or known["BRIEF_TO"] or die("at least one recipient is required")
    recipients = ", ".join(a.strip() for a in recipients.replace(";", ",").split(",")
                           if a.strip())

    print("\n  Gmail app password. Input is hidden; spaces are fine, they are")
    print("  stripped. Generate one at https://myaccount.google.com/apppasswords")
    password = getpass.getpass("  App password: ")
    password = re.sub(r"\s+", "", password)
    if not password:
        die("no password entered")
    if len(password) != 16:
        print(f"\n  Note: that is {len(password)} characters; Google app passwords are 16.")
        if input("  Continue anyway? [y/N] ").strip().lower() not in ("y", "yes"):
            die("stopped, nothing stored")

    verify_smtp(sender, password)
    need_pynacl()

    _, pk = call("GET", f"/repos/{repo}/actions/secrets/public-key", token)
    call("PUT", f"/repos/{repo}/actions/secrets/{SECRET_NAME}", token,
         {"encrypted_value": seal(pk["key"], password), "key_id": pk["key_id"]})
    del password

    put_variable(repo, token, "BRIEF_FROM", sender)
    put_variable(repo, token, "BRIEF_TO", recipients)

    print("\n  stored:")
    show(read_state(repo, token))

    if args.test or input("\n  Trigger a test run that emails the issue now? [y/N] "
                          ).strip().lower() in ("y", "yes"):
        call("POST", f"/repos/{repo}/actions/workflows/{WORKFLOW}/dispatches", token,
             {"ref": "main", "inputs": {"weeks": "1", "send": "true"}})
        print(f"  dispatched - watch https://github.com/{repo}/actions")
        print("  Note: it only emails if the build produces a new issue; if this")
        print("  week's is already committed, the run is a no-op by design.")
    else:
        print("\n  Done. The next scheduled Monday run will email the issue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
