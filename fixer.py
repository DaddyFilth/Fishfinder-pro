from pathlib import Path

path = Path("src/components/BiteTimePanel.tsx")
s = path.read_text()
s = s.replace("import { useState, useCallback } from 'react';", "import { useState } from 'react';")
s = s.replace("const fetchAIPrediction = useCallback(async (species: string) => {", "const fetchAIPrediction = async (species: string) => {")
s = s.replace("}, [lat, lng, conditions, solunar.solunarScore, solunar.moonPhaseName]);", "};")
s = s.replace("Today's", "Today&apos;s")
s = s.replace("today's", "today&apos;s")
path.write_text(s)
print("BiteTimePanel fixed")

path = Path("src/components/ai/FishIdentifierModal.tsx")
lines = path.read_text().splitlines()
new_lines = []
for line in lines:
    if line == "import { useRef, useState } from 'react';":
        new_lines.append("import { ChangeEvent, useRef, useState } from 'react';")
    elif line == "export default function FishIdentifierModal({ isOpen, onClose, onApplyToCatch }: any) {":
        block = [
            "interface FishIdentifierResult {",
            "  is_fish?: boolean;",
            "  species?: string;",
            "  scientific_name?: string;",
            "  confidence?: number;",
            "  size_estimate?: string;",
            "  weight_estimate?: string;",
            "  best_baits?: string[];",
            "  distinguishing_features?: string[];",
            "  fun_fact?: string;",
            "}",
            "",
            "interface CatchAutofillData {",
            "  species?: string;",
            "  weight_lbs?: string;",
            "  length_in?: string;",
            "  bait?: string;",
            "  notes?: string;",
            "}",
            "",
            "interface FishIdentifierModalProps {",
            "  isOpen: boolean;",
            "  onClose: () => void;",
            "  onApplyToCatch?: (data: CatchAutofillData) => void;",
            "}",
            "",
            "export default function FishIdentifierModal({ isOpen, onClose, onApplyToCatch }: FishIdentifierModalProps) {",
        ]
        new_lines.extend(block)
    elif line.strip() == "const [result, setResult] = useState<any>(null);":
        new_lines.append("  const [result, setResult] = useState<FishIdentifierResult | null>(null);")
    elif line.strip() == "const handleImage = (e: any) => {":
        new_lines.append("  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {")
    elif line.strip() == "reader.onload = (evt: any) => {":
        new_lines.append("    reader.onload = (evt: ProgressEvent<FileReader>) => {")
    elif line.strip() == "const b64 = evt.target.result;":
        new_lines.append("      const b64 = evt.target?.result as string;")
    elif line.strip() == "} catch (err: any) {":
        new_lines.append("    } catch (err: unknown) {")
    elif "setError(err.message" in line:
        new_lines.append("      setError(err instanceof Error ? err.message : 'Error connecting to AI model');")
    else:
        new_lines.append(line)
path.write_text("\n".join(new_lines))
print("FishIdentifierModal fixed")

path = Path("src/components/logbook/CatchLogger.tsx")
lines = path.read_text().splitlines()
lines = [l for l in lines if "import FishIdentifierModal" not in l]
path.write_text("\n".join(lines))
print("CatchLogger fixed")
