import { constRegion, constIdentityPoolId, constUserPoolId, constClientId, constCognitoProviderId } from './awsUserConfig'
import { signedUp, passwordChangeSuccess, verificationCodeSent, sendVerificationCodeFailed, noUserInfoAvail, passwordChangeError, updatingPassword, clearingUserMessages, loggingIn, loggedIn, loggedInError, loggingOut, loggingOutError, loggedOut, checkingSession, checkingSessionError, checkedSession } from './actionGenerators/agUsers'
var browserHistory = require('react-router').browserHistory;

// var AWS = require('aws-sdk');

// // Set the region where your identity pool exists (us-east-1, eu-west-1)
// AWS.config.region = 'us-east-1';

// // Configure the credentials provider to use your identity pool
// AWS.config.credentials = new AWS.CognitoIdentityCredentials({
//     IdentityPoolId: 'IDENTITY_POOL_ID',
// });

// // Make the call to obtain credentials
// AWS.config.credentials.get(function(){

//     // Credentials will be available when this function is called.
//     var accessKeyId = AWS.config.credentials.accessKeyId;
//     var secretAccessKey = AWS.config.credentials.secretAccessKey;
//     var sessionToken = AWS.config.credentials.sessionToken;

// });


var initUserPool = function(awsRegion, awsIdentityPoolId, awsUserPoolId, awsClientId){
  AWS.config.region = awsRegion;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: awsIdentityPoolId
    });

    AWSCognito.config.region = constRegion;
    AWSCognito.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: awsIdentityPoolId
    });

    // Need to provide placeholder keys unless unauthorised user access is enabled for user pool
    AWSCognito.config.update({accessKeyId: 'anything', secretAccessKey: 'anything'})

    var poolData = {
        UserPoolId : awsUserPoolId,
        ClientId : awsClientId
    };
    return new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);
};

let currentUser = {}


export function signUp(nickname, email, password){

  return function (dispatch) {
    dispatch(loggingIn());

    var userPool = initUserPool(constRegion,
              constIdentityPoolId,
              constUserPoolId,
              constClientId);

    AWS.config.region = constRegion;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: constIdentityPoolId
        });

    AWSCognito.config.region = constRegion;
    AWSCognito.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: constIdentityPoolId
        });

    var attributeList = [];

    var dataName = {
        Name : 'nickname',
        Value : nickname
    };

    var dataEmail = {
        Name : 'email',
        Value : email
    };

    var attributeEmail = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataEmail);
    var attributeName = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataName);

    attributeList.push(attributeEmail);
    attributeList.push(attributeName);

    userPool.signUp(nickname, password, attributeList, null, function(err, result){
        if (err) {
            console.log(err);
            return;
        }
        cognitoUser = result.user;
        console.log('user name is ' + cognitoUser.getUsername());
        dispatch(signedUp(cognitoUser.getUsername()));
    });
  }
}

export function confirmation(username, confirmCode){
  return function (dispatch) {

    var userPool = initUserPool(constRegion,
              constIdentityPoolId,
              constUserPoolId,
              constClientId);

    var userData = {
        Username : username,
        Pool : userPool
    };

    var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
    cognitoUser.confirmRegistration(confirmCode, true, function(err, result) {
        if (err) {
            alert(err);
            return;
        }
        console.log('call result: ' + result);
    });
  }
}


export function login(username, password) {

  return function (dispatch) {
    dispatch(loggingIn());

    console.log(username, password)

    var userPool = initUserPool(constRegion,
              constIdentityPoolId,
              constUserPoolId,
              constClientId);

    //console.log(userPool);

    AWS.config.region = constRegion;

    var authenticationData = {
          Username : username,
          Password : password
      };
      var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);

      var userData = {
          Username : username,
          Pool : userPool
      };
      var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
      // debugger;
      cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: function (result) {
            var jwtToken = result.getAccessToken().getJwtToken();
          //Use the AWS Identity Pool JWT Token to request temporary token from AWS Cognito Identity
          var logins = {};
          logins[constCognitoProviderId] = result.idToken.jwtToken;
          AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: constIdentityPoolId,
            IdentityId: AWS.config.credentials.identityId,
            Logins: logins
          });

          AWS.config.credentials.get(function (err) {
            // now I'm using authenticated credentials
            if(err)
            {
                console.log('error in autheticatig AWS'+err);
                dispatch(loggedInError(err));
            }
            else
            {
                //Successfully signed in, routes to dashboard

                //Pull Cognito Dataset
                var client = new AWS.CognitoSyncManager();

                client.openOrCreateDataset('ameco-users', function(err, dataset) {
                dataset.synchronize({

                  onSuccess: function(dataset, newRecords) {
                     dataset.get('ameco-users', function(err, value) {
                      if(err){
                        dispatch(loggedInError("No client associated with this account, please contact support."));
                      }
                      else{
                        if (value){
                          var data = JSON.parse(value);
                          dispatch(loggedIn(AWS.config.credentials.identityId, result.accessToken.jwtToken, data.clientId));
                        }
                        else{
                          dispatch(loggedInError("No client associated with this account, please contact support."));
                        }
                      }
                     });

                  },

                  onFailure: function(err) {
                     console.log('sync failure:' + err);
                  },

                  onConflict: function(dataset, conflicts, callback) {
                    //should never hit this as we really aren't allowing users to remove dataset
                    console.log('sync conflict:' + err);
                  },

                  onDatasetDeleted: function(dataset, datasetName, callback) {
                     // Return true to delete the local copy of the dataset.
                     // Return false to handle deleted datasets outside ethe synchronization callback.
                     return callback(true);
                  },

                  onDatasetMerged: function(dataset, datasetNames, callback) {
                     // Return true to continue the synchronization process.
                     // Return false to handle dataset merges outside the synchroniziation callback.
                     return callback(false);
                  }

                });

              });


            }
          });
        },
        onFailure: function(err) {
			var errResult = err.message;
			if(err.message.includes('Username/client id combination not found'))
			{
				errResult = 'Incorrect username or password.';
			}

            dispatch(loggedInError(errResult));
        },
    });
  };
}

export function checkSession() {
  return function (dispatch) {
    dispatch(checkingSession());
    var userPool = initUserPool(constRegion,
              constIdentityPoolId,
              constUserPoolId,
              constClientId);

    AWS.config.region = constRegion;

    var cognitoUser = userPool.getCurrentUser();

    if (cognitoUser != null) {
        cognitoUser.getSession(function(err, session) {
            if (err) {
                dispatch(checkingSessionError(err));
            }
            else
            {
              dispatch(checkedSession(session.accessToken.jwtToken));
            }
        })
    }
  }
}

export function logout() {
  return function (dispatch) {
    dispatch(loggingOut());

    AWS.config.region = constRegion;
    var userPool = initUserPool(constRegion,
              constIdentityPoolId,
              constUserPoolId,
              constClientId);

    var cognitoUser = userPool.getCurrentUser();

    if (cognitoUser != null) {
        cognitoUser.getSession(function(err, session) {
            if (err) {
                dispatch(loggingOutError(err));
            }
            else
            {
              cognitoUser.signOut();
              localStorage.clear();
              dispatch(loggedOut());
            }
        })
    }
    else
    {
      localStorage.clear();
    }
  }
}