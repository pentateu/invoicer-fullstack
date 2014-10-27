'use strict';

angular.module('invoicerApp')
  .controller('WorkStreamCtrl', function ($scope, $http, socket, $routeParams, $modal) {

    var uri = '/api/workStreams/';

    $scope.workStreamCtrl = {};
    $scope.workStreamCtrl.items = [];

    $scope.workStreamCtrl.newWorkStream = function(){
      $modal.open({
        templateUrl: 'app/newWorkstream/newWorkstream.html',
        controller: 'NewWorkstreamCtrl',
        backdrop: 'static'
      });
    };

    function cleanUp(item){
      var newItem = angular.copy(item);
      delete newItem.ctrl;
      return newItem;
    }

    function editableItem(item){
      var uri = '/api/items/';

      item.ctrl = {};
      item.ctrl.editMode = false;
      item.ctrl.edit = function () {
        item.ctrl.editMode = true;
      };
      item.ctrl.cancel = function () {
        item.ctrl.editMode = false;
      };
      item.ctrl.save = function () {
        $http.put(uri + '/' + item._id, cleanUp(item))
        .success(function(){
          item.ctrl.editMode = false;
        })
        .error(function() { //data, status, headers, config
          item.ctrl.invalid = true;
        });
      };
      item.ctrl.delete = function(){
        $http.delete(uri + '/' + item._id);
      };
      return item;
    }

    $http.get(uri + $routeParams.id).success(function(workStream) {
      $scope.workStreamCtrl.workStream = workStream;

      $http.get('/api/items/find?workStream=' + workStream._id)
        .success(function(items) {
          $scope.workStreamCtrl.items = items.map(function(item){
            return editableItem(item);
          });
        });

      socket.syncUpdates('item', $scope.workStreamCtrl.items);
    });

    $scope.addItem = function() {
      if($scope.newItem === '') {
        return;
      }
      $http.post(uri, { name: $scope.newThing });
      $scope.newThing = '';
    };

    $scope.$on('$destroy', function () {
      socket.unsyncUpdates('item');
    });

  });
