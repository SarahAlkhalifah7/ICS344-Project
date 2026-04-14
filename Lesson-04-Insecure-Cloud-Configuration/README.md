# Lesson 4: Insecure Cloud Configuration

* **Vulnerability:** The target S3 bucket is misconfigured to allow public `PutObject` actions, enabling unauthenticated file uploads.
* **Exploitation:** Run the first command in the `exploit-and-verify.sh` script to upload the dummy payload. Verify the attack by checking AWS CloudWatch for the corresponding Lambda execution log.
* **Fix:** Replace the vulnerable S3 bucket policy with the provided `secure-bucket-policy.json` file and enable "Block all public access" in the AWS console.
* **Verification:** Run the second command in the `.sh` script (using the `--no-sign-request` flag) to confirm that unauthenticated uploads are now successfully blocked and return an `AccessDenied` error.
