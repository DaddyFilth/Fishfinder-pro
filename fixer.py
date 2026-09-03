"""Apply small source fixes that are not convenient to perform manually."""

from pathlib import Path

P = Path("src/components/BiteTimePanel.tsx")
S = P.read_text()
S = S.replace(
    "import { useState, useCallback } from 'react';",
    "import { useState } from 'react';",
)
S = S.replace(
    "const fetchAIPrediction = useCallback(async (species: string) => {",
    "const fetchAIPrediction = async (species: string) => {",
)
S = S.replace(
    "}, [lat, lng, conditions, solunar.solunarScore, solunar.moonPhaseName]);",
    "};",
)
S = S.replace("Today's", "Today&apos;s")
S = S.replace("today's", "today&apos;s")
P.write_text(S)
print("BiteTimePanel fixed")

P = Path("src/components/ai/FishIdentifierModal.tsx")
LINES = P.read_text().splitlines()
NEW_LINES = []
for line in LINES:
    if line == "import { useRef, useState } from 'react';":
        NEW_LINES.append("import { ChangeEvent, useRef, useState } from 'react';")
    elif line == (
        "export default function FishIdentifierModal("
        "{ isOpen, onClose, onApplyToCatch }: any) {"
    ):
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
            "export default function FishIdentifierModal("
            "{ isOpen, onClose, onApplyToCatch }: FishIdentifierModalProps) {",
        ]
        NEW_LINES.extend(block)
    elif line.strip() == "const [result, setResult] = useState<any>(null);":
        NEW_LINES.append(
            "  const [result, setResult] = "
            "useState<FishIdentifierResult | null>(null);"
        )
    elif line.strip() == "const handleImage = (e: any) => {":
        NEW_LINES.append("  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {")
    elif line.strip() == "reader.onload = (evt: any) => {":
        NEW_LINES.append("    reader.onload = (evt: ProgressEvent<FileReader>) => {")
    elif line.strip() == "const b64 = evt.target.result;":
        NEW_LINES.append("      const b64 = evt.target?.result as string;")
    elif line.strip() == "} catch (err: any) {":
        NEW_LINES.append("    } catch (err: unknown) {")
    elif "setError(err.message" in line:
        NEW_LINES.append(
            "      setError(err instanceof Error ? err.message : "
            "'Error connecting to AI model');"
        )
    else:
        NEW_LINES.append(line)
P.write_text("\n".join(NEW_LINES))
print("FishIdentifierModal fixed")

P = Path("src/components/logbook/CatchLogger.tsx")
LINES = P.read_text().splitlines()
LINES = [line for line in LINES if "import FishIdentifierModal" not in line]
P.write_text("\n".join(LINES))
print("CatchLogger fixed")
