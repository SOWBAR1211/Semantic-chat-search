import re

LINE = re.compile(r"^(\d{1,2}/\d{1,2}/\d{2,4}), [^-]*? - ([^:]+): (.*)$")

def load(path):
    msgs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            m = LINE.match(line)
            if m:
                msgs.append([m.group(1), m.group(2), m.group(3)])
            elif msgs and line:
                msgs[-1][2] += " " + line

    return msgs

if __name__ == "__main__":
    msgs = load("chat.txt")
    print("Total lines parsed:", len(msgs))