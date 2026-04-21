def lambda_handler(event, context):
    # Authorization check - only allow admin invocations
    admin_secret = os.environ.get("ADMIN_SECRET", "")
    provided_secret = event.get("admin_secret", "")

    if not admin_secret or provided_secret != admin_secret:
        return {"status": "err", "msg": "unauthorized"}

    client = boto3.client('s3')
    resource = boto3.resource('s3')
    m = ""
    d = ""
    y = event["year"]
    if "month" in event:
        m = event["month"] + "/"
        if "day" in event:
            d = event["day"] + "/"

    prefix = "{}/{}{}".format(y, m, d)
    bucket = os.environ["RECEIPTS_BUCKET"]
    download_dir(client, resource, prefix, '/tmp', bucket)
    zip_file = "{}dvsa-order-receipts.zip".format(prefix.replace("/", "-"))

    zf = zipfile.ZipFile("/tmp/" + zip_file, "w")
    for dirname, subdirs, files in os.walk("/tmp"):
        zf.write(dirname)
        for filename in files:
            if filename.endswith(".txt"):
                zf.write(os.path.join(dirname, filename))
    zf.close()

    client.upload_file("/tmp/" + zip_file, bucket, "zip/" + zip_file)
    signed_link = client.generate_presigned_url('get_object',
                    Params={'Bucket': bucket, 'Key': "zip/" + zip_file},
                    ExpiresIn=3600)

    res = {"status": "ok", "download_url": signed_link}
    return res
