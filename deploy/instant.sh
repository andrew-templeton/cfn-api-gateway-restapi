#!/bin/sh
#############################################
# PLEASE HAVE AN AWS_PROFILE BEFORE RUNNING!
#############################################
# TERMINATES ON ANY ISSUES
set -e;
#############################################
# DEPLOYS TO ALL LAMBDA REGIONS BY DEFAULT
# THERE IS NO COST TO THE USER FOR THIS
REGIONS="us-east-1 us-west-2 eu-west-1 ap-northeast-1";
#############################################
#############################################
#############################################

# Housekeeping 
RESOURCE_TYPE='ApiGatewayRestApi';
FULL_NAME='CfnLambdaResource-'"$RESOURCE_TYPE";
ZIP_LOCATION='/tmp/'"$FULL_NAME"'.zip';
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
# Fastest way to get your Account Number.
ACCOUNT_NUMBER=$(aws iam get-user \
  --output json \
  --region us-east-1 \
  | grep \"Arn\" \
  | sed 's/        "Arn": "arn:aws:iam:://g' \
  | sed 's/:user.*//');

# Time to bundle repo root
cd $DIR'/../';
echo '';
echo 'Zipping Lambda bundle...';
zip -r "$ZIP_LOCATION" * > '/dev/null';
echo '';

# Globally Applied
echo 'Creating a Role for the Lambda in IAM...';
aws iam create-role --path '/' \
  --role-name "$FULL_NAME" \
  --assume-role-policy-document 'file://'"$DIR"'/../iam/trust.json' > '/dev/null';
echo 'Added Role!';
echo '';

#Globally Applied
echo 'Applying a Policy to the Role...';
aws iam put-role-policy \
  --role-name "$FULL_NAME" \
  --policy-name "$FULL_NAME"'_policy' \
  --policy-document 'file://'"$DIR"'/../iam/policy.json' > '/dev/null';
echo 'Added Policy!';
echo '';

# Script is literally too fast for IAM to propagate... :P
echo 'Sleeping for 5s to allow IAM propagation...';
for (( i = 1 ; i <= 5 ; i++ )); do
  sleep 1;
  echo '...zzz...';
done 
echo '';

# Globally Applied
echo 'Beginning deploy of Lambdas to Regions: '"$REGIONS";
for REGION in $REGIONS; do
  echo 'Deploying Lambda to: '"$REGION";
  aws --region "$REGION" lambda create-function \
    --function-name "$FULL_NAME" \
    --runtime 'nodejs' \
    --role 'arn:aws:iam::'"$ACCOUNT_NUMBER"':role/'"$FULL_NAME" \
    --handler 'index.handler' \
    --description 'CloudFormation Custom Resource service for Custom::'"$RESOURCE_TYPE" \
    --timeout '10' \
    --memory-size '128' \
    --zip-file 'fileb://'"$ZIP_LOCATION" > '/dev/null';
done

# Whee
echo '';
echo '~~~~ All done! Lambdas are deployed globally and ready for use by CloudFormation. ~~~~';
exit 0;

