---
name: prism-core-x1
description: Council-gated ClawRouter utility for policy-validated routing, sandbox testing, and audit-grade promotion.
compatibility: Created for Zo Computer
metadata:
  author: remysr.zo.computer
  version: "1.0"
  category: Decision
  display-name: Prism-Core-X1
---

# Prism-Core-X1

## Purpose
Prism-Core-X1 is a LoveLogic Prism utility that converts a request into a governed routing decision.
It blends Model Council deliberation with the ClawRouter pre-routing spec, then validates the
result against Orion policy rules before promotion.

## Intended Use
- Task triage for Jeremy's system
- Model/provider routing with cost and latency awareness
- Policy-aware sandbox validation
- Promotion logging with audit traceability

## Council Loop
1. Normalize the input context.
2. Gather fresh signals from recent logs and current runtime health.
3. Convene the Model Council perspectives:
   - Architect
   - Operator
   - Economist
   - Innovator
   - Skeptic
   - Founder
4. Apply ClawRouter scoring signals:
   - quality
   - speed
   - cost
   - context_window
   - reasoning_depth
   - tool_use
   - code_gen
   - creativity
   - factual_accuracy
   - safety
   - latency
   - throughput
   - availability
   - special_features
5. Synthesize a candidate utility spec.
6. Validate the spec against Orion policy rules.
7. Run the sandbox gate.
8. If the gate passes, promote the utility and write an audit entry.

## Candidate Utility
**Name:** Prism-Core-X1

**Mission:**
- Provide a governed, IP-first routing and validation utility for LoveLogicAI.
- Keep decisions local, auditable, and reversible.
- Avoid external side effects unless explicitly approved.

## Orion Policy Validation Checklist
- Reads and tests only during the sandbox gate
- No environment changes
- No external communications
- No destructive actions
- No modification of guardrails or Zo core config
- Logs every reversible action

## Sandbox Gate
The sandbox gate should confirm:
- the spec file exists
- the utility name is brand-consistent
- policy constraints are present
- the candidate avoids forbidden actions
- the audit entry can be written successfully

## Promotion Criteria
Promote only if all of the following are true:
- recent council signals were collected
- the spec aligns with ClawRouter + Model Council design intent
- policy validation passes
- sandbox gate passes
- audit entry is appended

## Expected Output
- route recommendation
- confidence summary
- fallback chain
- policy status
- promotion decision
- audit log record

## Breakthrough Frame
Prism-Core-X1 is designed as a reusable bridge between decision synthesis and safe execution.
It turns the Model Council from a discussion tool into a governable utility with a formal gate.
