'use strict';

angular.module('invoicerApp')
  .controller('NewWorkstreamCtrl', function ($scope, $modalInstance, $http, $location) {

    var uri = '/api/workStreams/';

    $scope.newWorkstreamCtrl = {
      workstream:{}
    };

    $scope.newWorkstreamCtrl.save = function(form){
      if(!form.$invalid){

        $http.post(uri, { name: $scope.newWorkstreamCtrl.workstream.name })
          .then(function(response){
            $modalInstance.dismiss('save');

            $location.url('/workStream/' + response.data._id);
          });
      }
    };

    $scope.newWorkstreamCtrl.cancel = function(){
      $modalInstance.dismiss('cancel');
    };

  });
