'use strict';

angular.module('invoicerApp')
  .directive('taskPanel', function ($modal,
    $http, localStore, $log, Auth, $q) {
    return {
      templateUrl: 'components/taskPanel/taskPanel.html',
      restrict: 'EA',
      link: function (scope) {

        var url = '/api/currentTasks';
        var timerRef = null;

        scope.task = {};

        function resetTask(){
          scope.task.id = null;
          scope.task.name = '';
          scope.task.totalSeconds = 0;
          scope.task.userId = Auth.getCurrentUser()._id;
          scope.task.date = new Date();
          scope.task.started = false;
          scope.task.editHour = false;
          scope.task.time = '0:00';
          scope.task.seconds = '00';
          scope.task.moment = null;
          scope.task.workStream = {};
        }

        resetTask();

        function restoreTaskFromServer(currentTask){
          scope.task.id           = currentTask._id;
          scope.task.name         = currentTask.name;
          scope.task.totalSeconds = currentTask.totalSeconds;
          scope.task.userId       = currentTask.userId;
          scope.task.date         = moment(currentTask.date).toDate();
          scope.task.started      = currentTask.started;
          scope.task.workStream   = {_id:currentTask.workStream};

          adjustMoment();
          formatTime();

          if(scope.task.started){
            scope.task.start();
          }

          $log.debug('task restored from server -> currentTask: ', currentTask);
        }

        function restoreTaskFromLocalStore(storedTask){
          scope.task.id           = storedTask.id;
          scope.task.name         = storedTask.name;
          scope.task.editHour     = storedTask.editHour;
          scope.task.started      = storedTask.started;
          scope.task.time         = storedTask.time;
          scope.task.seconds      = storedTask.seconds;
          scope.task.totalSeconds = storedTask.totalSeconds;
          scope.task.moment       = moment(storedTask.moment);
          scope.task.date         = moment(storedTask.date).toDate();
          scope.task.userId       = storedTask.userId;
          scope.task.workStream   = storedTask.workStream;

          if(scope.task.started){
            scope.task.start();
          }

          $log.debug('task restored from localStore -> storedTask: ', storedTask);
        }

        function loadTaskFromServer(){
          $log.debug('load current task for user', scope.task.userId);

          if(scope.task.userId){
            $http.get(url + '/findOne?userId=' + scope.task.userId)
              .success(restoreTaskFromServer)
              .error(function() {
                $log.debug('could not find current task for user, will try to recover from localStore');

                localStore.load(currentTaskKey())
                  .then(restoreTaskFromLocalStore);

              });
          }
          else{
            $log.info('loadTaskFromServer() -> NO userId !!!');
          }
        }

        //check if user is logged in
        Auth.isLoggedInAsync(function(loggedIn) {
          if (loggedIn) {
            scope.task.userId = Auth.getCurrentUser()._id;
            loadTaskFromServer();
          }
        });

        scope.task.editTime = function(){
          scope.task.editingTime = true;

          scope.task.stop();

          scope.task.timeValue = scope.task.time;
        };

        var hourMatch = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

        scope.task.doneEditTime = function(){
          var newTime = hourMatch.exec(scope.task.timeValue);

          if(newTime){
            scope.task.editingTime = false;
            scope.task.invalidTime = false;

            var hours = parseInt(newTime[1]),
                minutes = parseInt(newTime[2]);

            scope.task.totalSeconds = (hours * 60 * 60);
            scope.task.totalSeconds += (minutes * 60);
            scope.task.totalSeconds += parseInt(scope.task.seconds);

            adjustMoment();

            formatTime();

            scope.task.timeValue = null;
          }
          else{
            scope.task.invalidTime = true;
          }
        };

        function adjustMoment(){
          scope.task.moment = moment();
          if(scope.task.totalSeconds && scope.task.totalSeconds > 0){
            scope.task.moment.add(-(scope.task.totalSeconds), 's');
          }
        }

        scope.task.start = function(){
          scope.task.started = true;

          adjustMoment();

          formatTime();
          tick();
        };

        scope.task.stop = function(){
          if(scope.task.started){
            scope.task.started = false;

            if(timerRef){
              clearTimeout(timerRef);
            }

            if(!scope.task.moment){
              scope.task.moment = moment();
            }

            formatTime();

            return saveTime();
          }

          return $q.reject('Task is not started');
        };

        var TaskModalCtrl = function($scope, $modalInstance, task) {
          $scope.task = task;

          $log.debug('TaskModalCtrl -> ', task);

          function matchSelectedWorkStream(){
            if($scope.workStreams && $scope.task.workStream && $scope.task.workStream._id){
              var found = $scope.workStreams.find(function(item){
                return item._id === $scope.task.workStream._id;
              });
              if(found){
                $scope.task.workStream = found;
              }
            }
          }

          matchSelectedWorkStream();

          $scope.saveTask = function (form) {
            if( ! form.$invalid){
              $modalInstance.close($scope.task);
            }
          };

          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };

          $scope.calendarOpened = false;

          $scope.openCalendar = function($event){
            $event.preventDefault();
            $event.stopPropagation();
            $scope.calendarOpened = true;
          };

          $scope.dateOptions = {
            formatYear: 'yy',
            startingDay: 1
          };

          $http.get('/api/workStreams').success(function(workStreams) {
            $scope.workStreams = workStreams;
            matchSelectedWorkStream();
          });

        };

        scope.task.openTaskeModal = function(){
          var taskModal = $modal.open({
            templateUrl: 'saveTaskModal.html',
            controller: TaskModalCtrl,
            backdrop: 'static',
            resolve: {
              task: function () {
                return scope.task;
              }
            }
          });

          taskModal.result
            .then(function () {
              saveItem();
            })
            .catch(function () {
              $log.info('Modal dismissed at: ' + new Date());
            });
        };

        function secondsToHoursFraction(seconds){
          return seconds / 60 / 60;
        }

        function saveItem(){
          scope.task.stop();

          if(scope.task.editingTime){
            scope.task.doneEditTime();
          }

          var item = {
            name: scope.task.name,
            dateTime: scope.task.date,
            hours: secondsToHoursFraction(scope.task.totalSeconds),
            userId: scope.task.userId,
            workStream: scope.task.workStream._id
          };
          return $http.post('/api/items', item)
            .success(function(){
              $log.debug('Task Item saved !');
              deleteCurrentTask();
              resetTask();
            })
            .error(function() {
              $log.debug('could not save new item');
            });
        }

        function tick(){
          timerRef = setTimeout(function(){
            formatTime();
            saveTime();

            if(scope.task.started){
              tick();
            }

            scope.$apply();
          }, 1000);
        }

        function formatTime(){
          var diff = moment().subtract(scope.task.moment);
          scope.task.time = diff.format('H:mm');
          scope.task.seconds = diff.format('ss');
        }

        function deleteCurrentTask(){
          if(scope.task.id){
            $http.delete(url + '/' + scope.task.id)
              .catch(function() {
                $log.debug('could not delete current task from server');
              });
          }

          localStore.remove(currentTaskKey())
            .catch(function() {
              $log.debug('could not delete current task from localStorage');
            });
        }

        function saveToServer(){
          var objToSave = {
            name:         scope.task.name,
            totalSeconds: scope.task.totalSeconds,
            date:         scope.task.date,
            userId:       scope.task.userId,
            started:      scope.task.started,
            workStream:   scope.task.workStream._id
          };

          if(scope.task.id){
            return $http.put(url + '/' + scope.task.id, objToSave)
            .error(function() {
              $log.debug('could not update task');
            });
          }
          else{
            return $http.post(url, objToSave)
              .success(function(addedTask){
                scope.task.id = addedTask._id;

                $log.debug('task saved to the server -> ', addedTask);

                return addedTask;
              })
              .error(function() {
                $log.debug('could not save new task');
              });
          }
        }

        function currentTaskKey(){
          if(Auth.getCurrentUser()._id){
            return 'currentTask_user_' + Auth.getCurrentUser()._id;
          }
          return null;
        }

        //save the current task to local storage and to server
        function saveTime(){
          scope.task.totalSeconds = moment().unix() - scope.task.moment.unix();

          return localStore.save(currentTaskKey(), scope.task)
            .then(saveToServer)
            .catch(function(err){
              //error
              $log.error('Error saving current task: ' + err);
            });
        }

      }
    };
  });
