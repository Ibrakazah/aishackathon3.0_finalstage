path = "src/app/components/Reports.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

changes = 0

for i, line in enumerate(lines):
    # Fix line 190 (handleConfirmData): revert back to just "load"
    if '} else if (reportType === "load" || reportType === "bullying") {' in line and 'rows' not in lines[i+1] if i+1 < len(lines) else False:
        pass  # skip - will handle below
    
    if i == 189 and '"load" || reportType === "bullying"' in line:
        lines[i] = line.replace('"load" || reportType === "bullying"', '"load"')
        changes += 1
        print(f"Fixed line {i+1}: handleConfirmData branch - removed bullying from load branch")
    
    # Fix line 435 (button onClick): add bullying
    if i == 434 and 'reportType === "load"' in line and 'bullying' not in line:
        lines[i] = line.replace('reportType === "load"', 'reportType === "load" || reportType === "bullying"')
        changes += 1
        print(f"Fixed line {i+1}: button onClick - added bullying to skip asking")

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\nTotal changes: {changes}")
