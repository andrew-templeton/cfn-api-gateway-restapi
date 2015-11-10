
var AWS = require('aws-sdk');

var CfnLambda = require('cfn-lambda');

var RestApiSchema = {
  Type: 'object',
  required: [
    'Name'
  ],
  properties: {
    Name: {
      type: 'string'
    },
    BaseApiId: {
      type: 'string'
    },
    Description: {
      type: 'string'
    }
  }
};

exports.handler = ApiGatewayRestApiHandler;

function ApiGatewayRestApiHandler(event, context) {
  var ApiGatewayRestApi = CfnLambda({
    Create: Create,
    Update: Update,
    Delete: Delete,
    Validate: RestApiSchema,
    NoUpdate: NoUpdate
  });
  // Not sure if there's a better way to do this...
  AWS.config.region = currentRegion(context);
  var APIG = new AWS.APIGateway({apiVersion: '2015-07-09'});
  
  return ApiGatewayRestApi(event, context);


  function Create(params, reply) {
    APIG.createRestApi({
      name: params.Name,
      cloneFrom: params.BaseApiId,
      description: params.Description
    }, handleReply(reply));
  }

  function Update(physicalId, params, oldParams, reply) {
    // Full replace
    if (params.BaseApiId !== oldParams.BaseApiId) {
      return Delete(physicalId, null, function(deletionError) {
        if (deletionError) {
          return reply(deletionError);
        }
        Create(params, reply);
      });
    }
    var params = {
      restApiId: physicalId,
      patchOperations: []
    };

    ['Name', 'Description'].forEach(patch);

    APIG.updateRestApi(params, handleReply(reply));

    function patch(key) {
      var keyPath = '/' + key.toLowerCase();
      if (params[key] === oldParams[key]) {
        return;
      }
      if (!oldParams[key]) {
        return params.patchOperations.push({
          op: 'add',
          path: keyPath,
          value: params[key]
        });
      }
      if (!params[key]) {
        return params.patchOperations.push({
          op: 'remove',
          path: keyPath
        });
      }
      params.patchOperations.push({
        op: 'replace',
        path: keyPath,
        value: params[key]
      });
    }
  }

  

  function Delete(physicalId, params, reply) {
    APIG.deleteRestApi({
      restApiId: physicalId
    }, function(err, data) {
      // Already deleted, which is fine
      if (!err || err.statusCode === 404) {
        return reply();
      }
      reply(err.message);
    });
  }

  function NoUpdate(old, fresh) {
    return [
      'Name',
      'Description',
      'BaseApiId'
    ].every(function(key) {
      return old[key] === fresh[key];
    });
  }

};

function handleReply(reply) {
  return function(err, api) {
    if (err) {
      console.error(err.message);
      return reply(err);
    }
    reply(null, api.id, {
      Name: api.name,
      Description: api.description,
      CreatedDate: api.createdDate
    });
  }
}

function currentRegion(context) {
  return context.invokedFunctionArn.match(/^arn:aws:lambda:(\w+-\w+-\d+):/)[1];
}
