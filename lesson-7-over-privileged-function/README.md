# Lesson 7: The Over-Privileged Function (IAM Wildcard Vulnerability)

Welcome to Lesson 7! In this lab, we explore one of the most common and dangerous mistakes in cloud security: **Over-Privileged IAM Roles**. 

When building cloud applications, developers sometimes use wildcards (`*`) in their permissions to make things work quickly. However, if a hacker manages to compromise a single piece of the application (like a simple email function), those wildcards give them the keys to the entire kingdom. 

In this lesson, we will act as an attacker to steal a database, and then act as a cloud security engineer to fix the vulnerability using the **Principle of Least Privilege**.

---

## 🎯 Learning Objectives
By the end of this lab, you will understand how to:
1. Identify dangerous wildcard (`*`) permissions in AWS IAM Policies.
2. Use the **AWS IAM Policy Simulator** to test blast radius.
3. Extract temporary STS credentials from a Lambda function's environment variables.
4. Hijack an IAM Role using the AWS CLI to steal backend data.
5. Generate a secure, least-privilege policy using **AWS CloudTrail** and **IAM Access Analyzer**.

---

## 🛠️ Prerequisites
To follow along, you need:
- Access to an AWS Account with the vulnerable DVSA (Damn Vulnerable Serverless Application) deployed.
- **AWS CloudShell** or a local terminal with the AWS CLI installed.
- Basic understanding of AWS Lambda, S3, and DynamoDB.

---

## 🛑 Phase 1: The Vulnerability Discovery
The target is a Lambda function called `DVSA-SEND-RECEIPT-EMAIL`. Its only job is to send a receipt when a user drops a file into an S3 bucket.

1. Go to **AWS IAM** -> **Roles** and find the execution role for this function (starts with `serverlessrepo-OWASP-DVSA-SendReceiptFunctionRole`).
2. Look at the attached policies (e.g., `SendReceiptFunctionRolePolicy2`).
3. You will notice this massive security flaw:
   ```json
   "Action": [
       "dynamodb:Scan",
       "dynamodb:DeleteItem"
   ],
   "Resource": "*"
   ```
