'use strict';

describe('Directive: taskPanel', function () {

  // load the directive's module and view
  beforeEach(module('invoicerApp'));
  beforeEach(module('components/taskPanel/taskPanel.html'));

  var element, scope, httpBackend,
    userId = '1234567890',
    Auth, $log, localStore;

  beforeEach(inject(function ($rootScope, $httpBackend, _Auth_, _$log_, _localStore_) {
    scope = $rootScope.$new();
    httpBackend = $httpBackend;
    Auth = _Auth_;
    $log = _$log_;
    localStore = _localStore_;

    //mocking the Auth obj
    Auth.getCurrentUser = function(){
      return {_id:userId, role:'tester'};
    }
    Auth.isLoggedInAsync = function(callBack){
      callBack(true);
    };

    httpBackend.whenGET('/api/workStreams')
      .respond([{_id:100, name:'workStream 01'}]);

    delete localStorage['currentTask_user_' + userId];
  }));

  //configure angular.$log flush
  beforeEach(function(){
    function autoFlush(prop){
      var original = $log[prop];
      if(original.AUTO_FLUSH === true){
        return;
      }

      $log[prop] = function (msg, param){
        if(param){
          original(msg, param);
          console[prop](msg, param);
        }
        else{
          original(msg);
          console[prop](msg);
        }
      };

      $log[prop].logs = original.logs;

      $log[prop].AUTO_FLUSH = true;
    }

    autoFlush('debug');
    autoFlush('log');
    autoFlush('info');
    autoFlush('warn');
    autoFlush('error');

  });

  function expectSaveRequest(validatorFn){

    validatorFn = validatorFn || function(){return true;};

    httpBackend.expectPOST('/api/currentTasks', validatorFn)
      .respond([{_id:100, name:'task xyz'}]);
  }

  function expectFindRequest(withSavedTask){
    if(withSavedTask){
      httpBackend.expectGET('/api/currentTasks/findOne?userId=' + userId)
        .respond(200, {_id:87654, name:'saved task', userId:userId});
    }
    else{
      //Respond with an error here..
      //so the directive does not load a previous task.
      httpBackend.expectGET('/api/currentTasks/findOne?userId=' + userId)
        .respond(404, '');
    }
  }

  function start(){
    angular.element(element.find('#task_start')[0]).click();
    scope.$apply();
  }

  function stop(){
    expectSaveRequest();

    angular.element(element.find('#task_stop')[0]).click();
    scope.$apply();
  }

  function build(withSavedTask){
    inject(function ($compile) {

      expectFindRequest(withSavedTask);

      element = angular.element('<task-panel></task-panel>');
      element = $compile(element)(scope);
      scope.$apply();

      assertDisplay('0:00:00');

      httpBackend.flush();
    });
  }

  function assertDisplay(value){
    expect(element.find('.hoursDisplay').text()).toBe(value);
  }

  describe('Compact Task Panel - save and load functions -', function () {

    it('should handle stop task error', function (done) {

      build();

      scope.task.stop().catch(function(error){

        expect(error).toBe('Task is not started');

        done();
      });
      scope.$apply();

    });

    it('should handle stop task success', function (done) {

      userId = '223'

      build();

      start();

      expectSaveRequest();//the stop functions saves the current task on server

      scope.task.stop().then(function(){

        done();
      });
      scope.$apply();
      httpBackend.flush();

    });

    it('should save workStream to localStorage and server', function (done) {
      build();

      scope.task.workStream = {_id:123, name:'workstream x'};

      start();

      //the stop functions saves the current task on server
      expectSaveRequest(function(payload){
        $log.debug('payload received by expect save -> ', payload);
        payload = JSON.parse(payload);
        return payload.workStream === 123;
      });

      scope.task.stop().then(function(){

        var fromLocalStorage = localStore.getItem('currentTask_user_' + userId);

        $log.debug('fromLocalStorage: ', fromLocalStorage);

        expect(fromLocalStorage.workStream._id).toBe(123);

        done();
      });
      scope.$apply();
      httpBackend.flush();

    });

    it('should not load an existing current task', function () {
      build();

      expect(scope.task.id).toBeFalsy();
    });

    it('should load an existing current task from server', function () {
      build(true);

      expect(scope.task.id).toBe(87654);
    });
  });

  describe('Compact Task Panel - timer - ', function () {

    it('should start timer with 0:00:00', function () {
      build();

      assertDisplay('0:00:00');
    });

    it('should load the task from localStore when the server calls fails', function () {

      localStore.setItem('currentTask_user_' + userId, {
        name:'saved on localStore',
        editHour:false,
        started:false,
        time:'1:20',
        seconds:'35',
        totalSeconds:0,
        date: new Date(),
        userId: userId
      });

      build();

      expect(scope.task.name).toBe('saved on localStore');
      expect(scope.task.time).toBe('1:20');
      expect(scope.task.seconds).toBe('35');

    });

    it('should be 0:00:01 after a second', function(done){

        build();

        expectSaveRequest();

        start();

        setTimeout(function(){

          assertDisplay('0:00:01');

          done();

        }, 1100);

    });

    it('should be 0:10:00 after 10 minutes', function(){

      Timecop.install();

      build();

      start();

      //travel 10 min into the future
      Timecop.travel(moment().add(10, 'm').toDate());

      stop();

      assertDisplay('0:10:00');

      Timecop.uninstall();
    });

    it('should be 1:59:59', function(){

      Timecop.install();

      build();

      start();

      //travel into the future
      Timecop.travel(moment()
        .add(1, 'h')
        .add(59, 'm')
        .add(59, 's')
        .toDate());

      stop();

      assertDisplay('1:59:59');

      Timecop.uninstall();
    });

    it('should calculate time with pause intervals', function(){

      Timecop.install();

      build();

      start();

      //travel into the future
      Timecop.travel(moment()
        .add(15, 'm')
        .add(30, 's')
        .toDate());

      stop();

      assertDisplay('0:15:30');

      start();

      //travel into the future
      Timecop.travel(moment()
        .add(5, 'm')
        .toDate());

      stop();

      assertDisplay('0:20:30');

      Timecop.uninstall();
    });
  });

  describe('Edit Task Modal', function () {
    function openModal(){
      httpBackend.expectGET('/api/workStreams');

      angular.element(element.find('#open_task_modal')[0]).click();
      scope.$apply();

      httpBackend.flush();
    }

    it('should open modal', function(){

      build();

      openModal();

    });
  });



});
