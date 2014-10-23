'use strict';

angular.module('invoicerApp')
  .controller('NewWorkstreamCtrl', function ($scope, $modalInstance, $http) {

    var uri = '/api/workStreams/';

    $scope.newWorkstreamCtrl = {
      workstream:{}
    };

    $scope.newWorkstreamCtrl.save = function(form){
      if(!form.$invalid){

        $http.post(uri, { name: $scope.newWorkstreamCtrl.workstream.name })
          .then(function(){
            $modalInstance.dismiss('save');
          });
      }
    };

    $scope.newWorkstreamCtrl.cancel = function(){
      $modalInstance.dismiss('cancel');
    };

  });
