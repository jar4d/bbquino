
Router.configure({        
layoutTemplate: 'appTemplate', //this sets up a standard template
});

Router.route('/', {
      name:"gauges",
      template:"gauges"
      });
Router.route('/graphs', {
      name:"graphs",
      template:"graphs"
    });
Router.route('/settings',{
      name:"settings",
      template:"settings"
});

///*************BORROWED*************
Peripherals = new Mongo.Collection('Peripherals');
YawPitchRoll = new Mongo.Collection('YawPitchRoll');

NORDIC_NRF8001_SERVICE_UART = '6e400001b5a3f393e0a9e50e24dcca9e'; // Custom UART service
NORDIC_NRF8001_CHAR_TX      = '6e400002b5a3f393e0a9e50e24dcca9e'; // Write
NORDIC_NRF8001_CHAR_RX      = '6e400003b5a3f393e0a9e50e24dcca9e'; // Read
///*************BORROWED*************






if (Meteor.isClient) {
///*************BORROWED*************

Meteor.subscribe('peripherals');
  Meteor.subscribe('yawpitchroll');

  YawPitchRoll.find().observeChanges({
    added: function () {
      console.log('YawPitchRoll observeChanges():added called');
    }
  });
  Template.settings.events({
    'click #btnStartScanning': function () {
      Meteor.call('ble:startScanning', function () {});
    },
    'click #btnStopScanning': function () {
      Meteor.call('ble:stopScanning', function () {});
    },
    'click #btnPurge': function () {
      Meteor.call('ble:purge', function () {});
    }
  });

  Template.settings.helpers({
    peripherals: function () {
      var results = Peripherals.find();
      
      return results;
      console.log(results);

    }
  });

  Template.peripheral.helpers({
    checkIf: function (status) {
      return status == 'connected' ? 'checked="checked"' : '';
    },
    isConnected: function (status) {
      return status == 'connected';
    },
    yawpitchroll: function (uuid) {
      return YawPitchRoll.find({}, {limit: 1, sort: {timestamp: -1}});
      console.log(YawPitchRoll.find({}, {limit: 1, sort: {timestamp: -1}}));

    }
  });

  Template.peripheral.events({
    'change input.peripheral-status': function (ev, template) {
      var uuid = ev.target.dataset.uuid;
      var is_checked = ev.target.checked;
      
      if (is_checked) {
        Meteor.call('ble:connect', uuid);
        console.log('ischecked true, peripheral ble:connect', uuid, ', is checked? ', is_checked)
      } else {
        Meteor.call('ble:disconnect', uuid);
        console.log('ischecked false, peripheral ble:disconnect', uuid, ', is checked? ', is_checked);
      }
    }
  });

///*************BORROWED*************






    Template.settings.events({
      'click button': function(event, template){
        console.log("scanning...");
        event.preventDefault();
            if(Meteor.isCordova){ //cordova specific
                //ble.scan(services, seconds, success, failure);
                ble.scan([], 5, function(device) {
                console.log(JSON.stringify(device));
                }, function(){console.log("nothing found")});

                setTimeout(ble.stopScan,
                    5000,
                    function() { console.log("Scan complete"); },
                    function() { console.log("stopScan failed"); }
                );
            }

        },












      'submit form': function(event){
        event.preventDefault();
        var deviceName = event.target.deviceName.value;
        console.log("connecting to " + deviceName);
        
        if(Meteor.isCordova){


        }


      }



    });

};

if (Meteor.isServer) {
  var Future = Npm.require('fibers/future');
  // Get the Noble npm package
  var noble = Meteor.npmRequire('noble');
  var peripheralObjects = {};

  var peripheralToJson = function (peripheral) {
    return {
      "state": peripheral.state,
      "uuid": peripheral.uuid,
      "address": peripheral.address,
      "advertisement": peripheral.advertisement,
      "rssi": peripheral.rssi,
      "services": peripheral.services
    };
  };

  // @TODO Let's keep track of the ble adapter state.
  noble.on('stateChange', function (state) {
    console.log('noble:stateChange', state);
  });


  // Start up.
  Meteor.startup(function () {
    // Clean out old records.
    //Peripherals.remove({});
  });

  Meteor.publish('peripherals', function () {
    return Peripherals.find();
  });

  Meteor.publish('yawpitchroll', function () {
    return YawPitchRoll.find();
  });


  var fut = new Future();
  var bleDiscover = function (peripheral) {
    
    console.log('on ble:discover', peripheral);
    peripheralObjects[peripheral.uuid] = peripheral;
    peripheralJSON = peripheralToJson(peripheral);
    Meteor.call('ble:discover', peripheralJSON);

    fut.return(true);
  };

  var bleConnect = function (uuid, peripheral) {
    
    // peripheral.discoverServices([NORDIC_NRF8001_SERVICE_UART], function (error, services) {
    //   console.log("Found Custom UART Service");
    // });

    bleDiscoverSomeServicesAndCharacteristicsBound(peripheral);

    var docPeripheral = Peripherals.findOne({uuid: uuid});
    Peripherals.update(docPeripheral._id, peripheralToJson(peripheral));

    console.log('ble:connect peripheral?', peripheral);
  };

  var bleDisconnect = function (uuid, peripheral) {
    
    var docPeripheral = Peripherals.findOne({uuid: uuid});
    Peripherals.update(docPeripheral._id, peripheralToJson(peripheral));

    console.log('ble:disconnect peripheral?', peripheral);
    return true;
  };
  var bleDiscoverSomeServicesAndCharacteristics = function(peripheral) {
    // Get the Custom UART service, and corresponding RX, TX characteristics.
    peripheral.discoverSomeServicesAndCharacteristics(
      [NORDIC_NRF8001_SERVICE_UART],
      [NORDIC_NRF8001_CHAR_TX, NORDIC_NRF8001_CHAR_RX],
      function (err, services, characteristics) {
        console.log('ble:connect, discover services/characteristics');

        var charRX, charTX; // RX is 'writeWithoutResponse', TX is 'notify'
        var index = 0;
        for (index = 0; index < characteristics.length; index++) {
          switch(characteristics[index].uuid) {
            case NORDIC_NRF8001_CHAR_RX : 
              charRX = characteristics[index];
              break;
            case NORDIC_NRF8001_CHAR_TX :
              charTX = characteristics[index];
              break;
          }
        }

        charRX.notify(true, function (err) {
          console.log('characteristics RX notify');
        });

        charRX.on('data', function (data, isNotification) {
          bleCharRXBound(peripheral.uuid, data, isNotification);
        });
      }
    );

    return true;
  };

  var bleCharRX = function (uuid, data, isNotification) {
    var ascii = data.toString('ascii');
    var ypr = ascii.split('|');
    var existing = YawPitchRoll.findOne({uuid: uuid});
    var yprRecord = {
      uuid: uuid,
      yaw: parseFloat(ypr[0]),
      pitch: parseFloat(ypr[1]),
      roll: parseFloat(ypr[2]),
      timestamp: Date.now()
    };

    if (!existing) {
      YawPitchRoll.insert(yprRecord);
    } else {
      YawPitchRoll.update(existing._id, yprRecord);
    }
    
    // console.log('RX: on data', ascii);
  };

  var findPeripheralByUUID = function (uuid, cb) {
    var Peripheral = peripheralObjects[uuid];
    
    if (!Peripheral) {
      // Try and find it again.
      console.log('attempting to find ' + uuid);
      noble.startScanning();

    } else {
      cb( Peripheral );
    }
  };

  var bleDiscoverBound = Meteor.bindEnvironment(bleDiscover);
  var bleConnectBound = Meteor.bindEnvironment(bleConnect);
  var bleDisconnectBound = Meteor.bindEnvironment(bleDisconnect);
  var bleDiscoverSomeServicesAndCharacteristicsBound = Meteor.bindEnvironment(bleDiscoverSomeServicesAndCharacteristics);
  var bleCharRXBound = Meteor.bindEnvironment(bleCharRX);

  Meteor.methods({
    'ble:startScanning': function () {
      Meteor.call('ble:purge');

      noble.startScanning();
      console.log('on ble:startScanning');
    },

    'ble:stopScanning': function () {
      noble.stopScanning();
      console.log('on ble:stopScanning');
    },

    'ble:purge': function () {
      Peripherals.remove({});
      YawPitchRoll.remove({});

      console.log('ble:purge, collection of peripherals is empty');
    },

    'ble:discover': function (peripheral) {
      check(peripheral.uuid, String);
      var existingRecord = Peripherals.findOne({uuid: peripheral.uuid});

      if (existingRecord) {
        Peripherals.update(existingRecord._id, peripheral);
        console.log('ble:discover, peripheral updated in collection');
      } else {
        Peripherals.insert(peripheral);
        console.log('ble:discover, peripheral inserted to collection');
      }
      
    },

    'ble:connect': function (uuid) {
      var Peripheral = findPeripheralByUUID(uuid, function (peripheral) {
        console.log('connect', uuid);
        peripheral.connect(function () {
          
          bleConnectBound(uuid, peripheral);
        });
      });
    },

    'ble:disconnect': function (uuid) {
      var Peripheral = findPeripheralByUUID(uuid, function (peripheral) {
        console.log('disconnect', uuid);
        peripheral.disconnect(function () {
          bleDisconnectBound(uuid, peripheral);
        });
      });
    }

  });

  
  noble.on('discover', bleDiscoverBound);
}


