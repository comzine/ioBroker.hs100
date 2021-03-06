/**
 *
 *      ioBroker hs100 Adapter
 *
 *      (c) 2014-2017 arteck <arteck@outlook.com>
 *
 *      MIT License
 *
 */

'use strict';
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const { Client } = require('tplink-smarthome-api');
const client = new Client();
const MAX_POWER_VALUE = 10 * 1000; // max value for power consumption: 10 kW

var err;
let ip;
var timer     = null;
var stopTimer = null;
var isStopping = false;
let host  = ''; // Name of the device

let adapter;

function startAdapter(options) {
      options = options || {};
      Object.assign(options, {
        name: 'hs100',
        
        stateChange: function (id, state) {
            setDevState(id, state); 
        },
          
        ready: function () {
            client.on('error', err => {
               adapter.log.warn('Error main : ' + err );  
            });
            main();
        },
        
        unload: function (callback) {
          if (timer) {
            clearInterval(timer);
            timer = 0;
          }
          isStopping = true;
          callback && callback();
        },
           
        objectChange: function (id, obj) {
           adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
        }     
      });
      adapter = new utils.Adapter(options);
      
      return adapter;
};
     
    

function stop() {
    if (stopTimer) clearTimeout(stopTimer);

    // Stop only if schedule mode
    if (adapter.common && adapter.common.mode == 'schedule') {
        stopTimer = setTimeout(function () {
            stopTimer = null;
            if (timer) clearInterval(timer);
            isStopping = true;
            adapter.stop();
        }, 30000);
    }
}

function setDevState(id, state) {
    var tmp = id.split('.');
    var dp  = tmp.pop();
    var idx = tmp.pop();

    ip = idx.replace(/[_\s]+/g, '.');
      
    client.getDevice({host: ip}).then((device)=> {
        device.on('error', err => {
          //client.on('error', function(exception) {
            adapter.log.debug('Error setDevice : ' + err );  
        });
                  
          if (device.model.indexOf("LB") != -1) {
              var lightstate = device.sysInfo.light_state;
  
              if (state.ack != null) {
                  if (state && !state.ack) {
                      if (dp == 'state') {                        
                            device.setPowerState(state.val).catch(err => {
				adapter.log.warn('setPowerState Socket connection Timeout : ' +  ip ); 
                            });
                      } else {
                        
                            findAndReplace(lightstate, dp , state.val);
                            device.lighting.setLightState(lightstate).catch(err => {
				adapter.log.warn('setLightState Socket connection Timeout : ' +  ip ); 
                            });
                      }
                  }
              }
          } else {
              if (state && !state.ack) {
                  if (dp == 'state') {
                        device.setPowerState(state.val).catch(err => {
				adapter.log.warn('LB setPowerState Socket connection Timeout : ' +  ip ); 
                            });                     
                  } else {
			if (dp == 'ledState') {                     
                        	device.setLedState(state.val).catch(err => {
					adapter.log.warn('LB setLedState Socket connection Timeout : ' +  ip ); 
                        	});    
			}
                  }
              }
          }       
    })
    .catch(function(result) {
        adapter.log.debug('Error getDevice' +  ip ); 
    });
};

function findAndReplace(object, value, replacevalue) {
    for (var x in object) {
        if (object.hasOwnProperty(x)) {
            if (x === value) {
                object[x] = parseInt(replacevalue);
            }
        }
    }
}


process.on('SIGINT', function () {
    if (timer) clearTimeout(timer);
});


function createStateDose(name, ip, callback) {
    var hs_sw_ver;
    var hs_hw_ver;
    var hs_model;
    var hs_mac;
    var hs_sysinfo;

// plug HS100
    var hs_current;
    var hs_power;
    var hs_total;
    var hs_ip;
    var hs_state;

    var id = ip.replace(/[.\s]+/g, '_');
    
    adapter.log.debug('create state');
    
    
    client.getDevice({host: ip}).then((result) => {
        result.on('error', err => {
          //client.on('error', function(exception) {
            adapter.log.debug('Error getDevice : ' + err );  
        });
        if (result) {
            hs_model = result.model;
            hs_state = result.sysInfo.relay_state;

            if (hs_state == 0) {
                hs_state = false;
            } else {
                hs_state = true;
            }

            adapter.createChannel('', id, {
                name: name || ip,
			      }, {
                ip: ip
            }, callback);
				
            adapter.createState('', id, 'last_update', {
                name: name || ip,
                def: -1,
                type: 'string',
                read: true,
                write: true,
                role: 'value',
                desc: 'last update'
            }, {
                ip: ip
            }, callback);

            adapter.createState('', id, 'state', {
                name: name || ip,
                def: hs_state,
                type: 'boolean',
                read: true,
                write: true,
                role: 'switch',
                desc: 'Switch on/off'
            }, {
                ip: ip
            }, callback);

            adapter.createState('', id, 'mac', {
                name: name || ip,
                def: result.mac,
                type: 'string',
                read: true,
                write: true,
                role: 'value',
                desc: 'Mac address'
            }, {
                ip: ip
            }, callback);

            adapter.createState('', id, 'sw_ver', {
                name: name || ip,
                def: result.softwareVersion,
                type: 'string',
                read: true,
                write: true,
                role: 'value',
                desc: 'sw_ver'
            }, {
                ip: ip
            }, callback);

            adapter.createState('', id, 'hw_ver', {
                name: name || ip,
                def: result.hardwareVersion,
                type: 'string',
                read: true,
                write: true,
                role: 'value',
                desc: 'hw_ver'
            }, {
                ip: ip
            }, callback);

            adapter.createState('', id, 'model', {
                name: name || ip,
                def: hs_model,
                type: 'string',
                read: true,
                write: true,
                role: 'value',
                desc: 'model'
            }, {
                ip: ip
            }, callback);

// plug HS110
            if (hs_model.indexOf("110") != -1) {
                adapter.createState('', id, 'current', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                write: true,
                    role: 'value',
                    desc: 'current'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'power', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                write: true,
                    role: 'value',
                    desc: 'power'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'totalNow', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'totalNow'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'totalMonthNow', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'totalMonthNow'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'voltage', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'voltage'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'ledState', {
                    name: name || ip,
                    def: hs_state,
                    type: 'boolean',
                    read: true,
                    write: true,
                    role: 'switch',
                    desc: 'Led on/off'
                  }, {
                    ip: ip
                }, callback);                
            }
// bulb LBxxx
            if (hs_model.indexOf("LB") != -1) {                   
                adapter.createState('', id, 'brightness', {
                    name: name || ip,
                    def: 100,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'brightness'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'saturation', {
                    name: name || ip,
                    def: 100,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'saturation'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'hue', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'color'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'color_temp', {
                    name: name || ip,
                    def: 2700,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'color_temp'
                }, {
                    ip: ip    
                }, callback);                  
                adapter.createState('', id, 'totalNow', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'totalNow'
                }, {
                    ip: ip
                }, callback);
                adapter.createState('', id, 'totalMonthNow', {
                    name: name || ip,
                    def: 0,
                    type: 'string',
                    read: true,
                    write: true,
                    role: 'value',
                    desc: 'totalMonthNow'
                }, {
                    ip: ip
                }, callback);
            }
        }
    })    
    .catch(function(result) {
      adapter.log.debug('Error createState ' +  ip ); 
    });
  
    adapter.log.debug(hs_model + ' generated ' + ip);
}

function addState(name, ip, active, callback) {
    if (active) {
      adapter.getObject(host, function (err, obj) {
          createStateDose(name, ip, callback);
      });
    }
}

function syncConfig(callback) {
    adapter.getStatesOf('', host, function (err, _states) {
        var configToDelete = [];
        var configToAdd    = [];
        var k;
        var id;
        if (adapter.config.devices) {
            for (k = 0; k < adapter.config.devices.length; k++) {
                configToAdd.push(adapter.config.devices[k].ip);
            }
        }

        var tasks = [];

        if (_states) {
            for (var j = 0; j < _states.length; j++) {
                var ip = _states[j].native.ip;
                if (!ip) {
                    adapter.log.warn('No IP address found for ' + JSON.stringify(_states[j]));
                    continue;
                }
                id = ip.replace(/[.\s]+/g, '_');
                var pos = configToAdd.indexOf(ip);
                if (pos != -1) {
                    configToAdd.splice(pos, 1);
                    for (var u = 0; u < adapter.config.devices.length; u++) {
                        if (adapter.config.devices[u].ip == ip) {
                            if (_states[j].common.name !== (adapter.config.devices[u].name || adapter.config.devices[u].ip)) {
                                tasks.push({
                                    type: 'extendObject',
                                    id:   _states[j]._id,
                                    data: {common: {name: (adapter.config.devices[u].name || adapter.config.devices[u].ip), read: true, write: false}}
                                });
                            } else if (typeof _states[j].common.read !== 'boolean') {
                                tasks.push({
                                    type: 'extendObject',
                                    id:   _states[j]._id,
                                    data: {common: {read: true, write: false}}
                                });
                            }
                        }
                    }
                } else {
                    configToDelete.push(ip);
                }
            }
        }

        if (configToDelete.length) {
            for (var e = 0; e < configToDelete.length; e++) {
                id = configToDelete[e].replace(/[.\s]+/g, '_');
                tasks.push({
                    type: 'deleteState',
                    id:   id
                });
            }
        }

        processTasks(tasks, function () {
            var count = 0;
            if (configToAdd.length) {
                for (var r = 0; r < adapter.config.devices.length; r++) {
                    if (configToAdd.indexOf(adapter.config.devices[r].ip !== -1)) {
                        count++;
                        addState(adapter.config.devices[r].name, adapter.config.devices[r].ip, adapter.config.devices[r].active, function () {
                            if (!--count && callback) {
                                callback();
                            }
                        });
                    }
                }
            }
            if (!count && callback) callback();
        });
    });
}

function processTasks(tasks, callback) {
    if (!tasks || !tasks.length) {
        callback && callback();
    } else {
        var task = tasks.shift();
        var timeout = setTimeout(function () {
            adapter.log.warn('please update js-controller to at least 1.2.0');
            timeout = null;
            processTasks(tasks, callback);
        }, 1000);

        if (task.type === 'extendObject') {
            adapter.extendObject(task.id, task.data, function (/* err */) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                    setImmediate(processTasks, tasks, callback);
                }
            });
        } else  if (task.type === 'deleteState') {
            adapter.deleteState('', host, task.id, function (/* err */) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                    setImmediate(processTasks, tasks, callback);
                }
            });
        } else {
            adapter.log.error('Unknown task name: ' + JSON.stringify(task));
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
                setImmediate(processTasks, tasks, callback);
            }
        }
    }
}

function updateDevice(ip) {

    var hs_state;
    var hs_sw_ver;
    var hs_hw_ver;
    var hs_model;
    var hs_mac;
    var hs_lastupdate;

// plug HS110
    var hs_current;
    var hs_power;
    var hs_total;
    var hs_voltage;
    var hs_emeter;
    var hs_led;
    
// bulb lb      
    var lb_bright;
    var lb_color_temp;
    var lb_hue;
    var lb_saturation;
    
    try {    
                           
    client.getDevice({host: ip}).then(function(result) {
        result.on('error', err => {
          //client.on('error', function(exception) {
            adapter.log.debug('Error getDevice : ' + err );  
        });
        if (result) {
            var jetzt = new Date();
            var hh =  jetzt.getHours();
            var mm =  jetzt.getMinutes();
            var ss =  jetzt.getSeconds();
            var jahr  = jetzt.getFullYear();
            var monat = jetzt.getMonth()+1;  // von 0 - 11 also +1
            var tag   = jetzt.getDate();

            if(hh < 10){hh = '0'+ hh;}
            if(mm < 10){mm = '0'+ mm;}
            if(ss < 10){ss = '0'+ ss;}

            hs_lastupdate = jahr + '.' + monat + '.' + tag + ' ' + hh + ':' + mm + ':' + ss;

            hs_mac    = result.mac;
            hs_sw_ver = result.softwareVersion;
            hs_hw_ver = result.hardwareVersion;
            hs_model  = result.model;

            if (hs_model.indexOf("LB") != -1) {
                hs_state = result.sysInfo.light_state.on_off;
            } else {
                hs_state = result.sysInfo.relay_state;
            }

            if (hs_state == 0) {
                hs_state = false;
            } else {
                hs_state = true;
            }

            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.sw_ver'  , hs_sw_ver || 'undefined', true);
            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.hw_ver'  , hs_hw_ver || 'undefined', true);
            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.model'   , hs_model  || 'undefined', true);
            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.mac'     , hs_mac    || 'undefined', true);
            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.state'   , hs_state, true);

            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.last_update', hs_lastupdate || '-1', true);

            adapter.log.debug('Refresh ' + ip + ' Model = '+ result.model + ' state = ' + hs_state + ' update = ' + hs_lastupdate);

            if (hs_model.indexOf("110") != -1) {
                result.emeter.getRealtime().then((resultRealtime) => {
                    if (typeof resultRealtime != "undefined") {
                        if (hs_hw_ver == "2.0" 
                        ||  hs_hw_ver == "3.0") {
                            hs_current = resultRealtime.current_ma;

                            if (resultRealtime.power_mw > 0) {
                                hs_power = resultRealtime.power_mw / 1000;
                            } else {
                                hs_power = resultRealtime.power_mw;
                            }

                            if (resultRealtime.voltage_mv > 0) {
                                hs_voltage = resultRealtime.voltage_mv / 1000;
                            } else {
                                hs_voltage = resultRealtime.voltage_mv;
                            }
                        } else {
                            hs_current = resultRealtime.current;
                            hs_power = resultRealtime.power;
                            hs_total = resultRealtime.total;
                            hs_voltage = Math.ceil(resultRealtime.voltage);
                        }
                        
                        if (result.sysInfo.led_off == 0) {
                          hs_led  = true;
                        } else {
                          hs_led  = false;
                        }
                        
                        adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.current', hs_current || '0', true);
                        if(hs_power < MAX_POWER_VALUE) {
                            adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.power', hs_power || '0', true);
                        }
                        adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.voltage', hs_voltage || '0', true);
                        adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.ledState', hs_led || '0', true);
                        adapter.log.debug('Refresh Data HS110 ' + ip);
                    }
                });
            }

            if (hs_model.indexOf("110") != -1
            ||  hs_model.indexOf("LB")  != -1) {
                result.emeter.getMonthStats(jahr).then((resultMonthStats) => {
                    var mothList = resultMonthStats.month_list;
                    var energy_v = 0;
                    for (var i = 0; i < mothList.length; i++) {
                        if (mothList[i].month === monat) {
                            if (mothList[i].energy != undefined) {
                                energy_v = mothList[i].energy;
                                break;
                            } else {
                                energy_v = mothList[i].energy_wh / 1000;
                                break;
                            }
                        }
                    }
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.totalMonthNow', energy_v || '0', true);
                    adapter.log.debug('Month value Model : '  + hs_model + ' IP : ' + ip);
                });

                result.emeter.getDayStats(jahr, monat).then((resultDayStats) => {
                    var dayList = resultDayStats.day_list;
                    var energy_v = 0;
                    for (var i = 0; i < dayList.length; i++) {
                        if (dayList[i].day === tag) {
                            if (dayList[i].energy != undefined) {
                                energy_v = dayList[i].energy;
                                break;
                            } else {
                                energy_v = dayList[i].energy_wh / 1000;
                                break;
                            }
                        }
                    }
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.totalNow', energy_v || '0', true);

                    adapter.log.debug('Day value for Model : ' + hs_model + ' Energy : ' + energy_v + ' IP : ' + ip);
                });
            }
        // Bulb
            if (hs_model.indexOf("LB") != -1) {
                if (result.sysInfo.is_dimmable == 1) {
                    var devLight = result.lighting.getLightState();
                    lb_bright     = result.sysInfo.light_state.brightness;
                    lb_color_temp = result.sysInfo.light_state.color_temp;
                    lb_hue        = result.sysInfo.light_state.hue;
                    lb_saturation = result.sysInfo.light_state.saturation;
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.brightness'   , lb_bright, true);
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.color_temp'   , lb_color_temp, true);
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.hue'   , lb_hue, true);  
                    adapter.setForeignState(adapter.namespace + '.' + ip.replace(/[.\s]+/g, '_') + '.saturation'   , lb_saturation, true);                      
                }
            }
        }
    })
    .catch(function(result) {
        adapter.log.debug('IP not found : ' + ip ); 
    });
	    
    } catch (e) {
       adapter.log.warn('getDevice Socket connection Timeout : ' +  ip ); 
    }
    
}


function getHS(hosts) {
    if (stopTimer) clearTimeout(stopTimer);

    if (!hosts) {
        hosts = [];
        for (var i = 0; i < adapter.config.devices.length; i++) {
            if (adapter.config.devices[i].ip.length > 5) {
                if (adapter.config.devices[i].active) {
                    hosts.push(adapter.config.devices[i].ip);
                }
            }
        }
    }

    if (!hosts.length) {
        timer = setTimeout(function () {
            getHS();
        }, adapter.config.interval);
        return;
    }

    var ip = hosts.pop();
    adapter.log.debug('HS Plug ' + ip);

    updateDevice(ip);

    if (!isStopping)  {
        setTimeout(function () {
            getHS(hosts);
        }, 0);
    };

}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 

function main() {
    host = adapter.host;
    adapter.log.debug('Host = ' + host);

    if (!adapter.config.devices.length) {
        adapter.log.info('No one IP configured');
        stop();
        return;
    }

    adapter.config.interval = parseInt(adapter.config.interval, 10);

// polling min 5 sec.
    if (adapter.config.interval < 5000) {
        adapter.config.interval = 5000;
    }

    syncConfig(function () {
        getHS();
    });

    adapter.subscribeStates('*');
}
