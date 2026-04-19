# 🛡️ Damn Vulnerable Serverless Application (DVSA) - Security Audit & Exploitation

Welcome to my Serverless Security Portfolio! This repository contains my technical investigations, exploit scripts, and remediation code for the OWASP Serverless Top 10 vulnerabilities, tested against the Damn Vulnerable Serverless Application (DVSA).

This project demonstrates the ability to identify, exploit, and secure infrastructure-as-code (IaC) and serverless application logic within an Amazon Web Services (AWS) environment.

---

## 🎯 Project Overview
Serverless architectures (like AWS Lambda, API Gateway, and DynamoDB) shift security responsibilities from traditional network perimeters to the application code and Identity and Access Management (IAM) configurations. 

This repository documents a series of hands-on security lessons. For each vulnerability, I assumed the role of an attacker to compromise the system, and then transitioned to a cloud security engineer to implement strict, least-privilege defenses.

### Key Competencies Demonstrated:
* **Cloud Infrastructure Exploitation:** Hijacking IAM roles, extracting STS credentials, and performing lateral movement.
* **Application Security (AppSec):** Exploiting insecure deserialization, broken authentication, and code injection.
* **Remediation & Hardening:** Writing strict IAM JSON policies, applying the Principle of Least Privilege, and mitigating vulnerable dependencies.
* **Security Auditing:** Utilizing AWS CloudTrail, CloudWatch Logs, and the IAM Policy Simulator to trace attack blast radiuses.

---

## 📂 Repository Structure
This repository is highly organized to ensure reproducibility. Each vulnerability is contained within its own isolated directory. 

```text
📦 serverless-security-dvsa
 ┣ 📂 lesson-4-Insecure-Cloud-Configuration
 ┣ 📂 lesson-7-over-privileged-function
 ┃ ┣ 📜 README.md                 # Lesson-specific explanation
 ┃ ┣ 📜 vulnerable_policy.json    # Original insecure IaC
 ┃ ┣ 📜 secure_policy.json        # Remediated IaC
 ┃ ┗ 📜 exploit_commands.sh       # Bash script to reproduce the attack
 ┣ 📂 lesson-9-vulnerable-dependencies
 ┃ ┣ 📜 README.md                 # Lesson-specific explanation
 ┃ ┣ 📜 vulnerable_handler.js     # Original insecure Lambda code
 ┃ ┣ 📜 secure_handler.js         # Remediated Lambda code
 ┃ ┗ 📜 exploit_payload.sh        # curl payload for Remote Code Execution (RCE)
 ┣ 📜 Final_Security_Report.pdf   # Comprehensive 10-part analysis of all lessons
 ┣ 📜 Presentation_Slides.pdf     # Executive summary slides
 ┗ 📜 README.md                   # You are here
```
🚀 How to Use This Repository (For Beginners)
If you are a student or security enthusiast looking to reproduce these attacks, please navigate to the specific lesson-X folder you wish to study.

Inside each folder, you will find:

The Lesson README: A beginner-friendly explanation of the vulnerability, how it works, and how to fix it.

Exploit Scripts (.sh): The exact terminal commands used to trigger the vulnerability.

Before/After Artifacts: The actual source code or IAM JSON configurations showing the exact fix applied to the serverless environment.

Prerequisites to Reproduce:
An active AWS Account with the DVSA deployed.

AWS CLI installed and configured.

Standard terminal utilities (curl, bash, jq).

📊 The 10-Part Analytical Methodology
For a deep dive into the security theory, please see the Final Security Report (PDF) included in this repository. Every lesson in this project was analyzed using a rigorous 10-part methodology:

Goal and Vulnerability Summary

Root Cause Analysis

Environment Setup

Reproduction Steps

Evidence and Proof (Logs & Screenshots)

Mitigation Strategy

Applied Code/Config Changes

Verification After Fix

Structured Operation and Security Analysis (Rule Deviations)

Architectural Lessons Learned

⚠️ Disclaimer
Educational Purposes Only. The code, scripts, and techniques provided in this repository are intended strictly for educational use within a safe, explicitly authorized, and legally provisioned training environment (DVSA). Do not execute these payloads or utilize these techniques against any systems, applications, or AWS accounts where you do not own the infrastructure or have explicit, written permission to conduct security testing.
