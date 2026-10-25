import re

DAY = re.compile(r"^## (\w+ \d{1,2}, \d{4})$")
MSG = re.compile(r"^\[(\d{1,2}:\d{2} [AP]M)\] \*\*(.+?):\*\*\s*(.*)$")
CALL = re.compile(r"^\[[^\]]+\] __\[Call\]__")
MEDIA = re.compile(r"^\[(Image|Video|Voice message|Sticker|album message)\]\s*(.*)$")
DOC = re.compile(r"^\[Document\]\s*(.*)$")


def clean(text):
    text = re.sub(r"^\[Forwarded\] ", "", text)
    m = MEDIA.match(text)
    if m:
        return m.group(2)
    m = DOC.match(text)
    if m:
        return m.group(1)
    return text


def parse_lines(lines):
    msgs, day, cur = [], "", None
    for line in lines:
        line = line.strip()
        d = DAY.match(line)
        if d:
            day, cur = d.group(1), None
        elif CALL.match(line) or line == "---":
            cur = None
        elif MSG.match(line):
            time, sender, text = MSG.match(line).groups()
            cur = [day + " " + time, sender, clean(text)]
            msgs.append(cur)
        elif line.startswith(">"):
            pass
        elif cur is not None and line and not line.startswith("#"):
            cur[2] = (cur[2] + " " + line).strip()
    return [m for m in msgs if m[2]]


def load(path):
    with open(path, encoding="utf-8") as f:
        return parse_lines(f)


if __name__ == "__main__":
    msgs = load("chat.md")
    print("Messages:", len(msgs))
    for m in msgs[:3]:
        print(m)