'use strict';

const Homey = require('homey');
const {DateTime} = require('luxon');

class EasyWatchAndAlert extends Homey.App {
  pollingTimeout;
  timeZone = this.homey.clock.getTimezone();
  timestampFormat = "dd.MM.yyyy HH:mm:ss"; // norsk format
  alertflowcard = undefined;
  eventflowcard = undefined;



  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {

    this.alertflowcard = this.homey.flow.getTriggerCard('alert');
    this.eventflowcard = this.homey.flow.getTriggerCard('event');

    this.log(`EasyWatchAndAlert has been initialized ...`);

    // if (process.env.DEBUG === '1'){
    //   try{ 
    //     require('inspector').waitForDebugger();
    //   }
    //   catch(error){
    //     require('inspector').open(9229, '0.0.0.0', true);
    //   }
    // }


    this.startPolling(1);

    // const now = DateTime.now().setZone(this.homey.clock.getTimezone()).toFormat("dd.MM.yyyy HH:mm:ss");
    // this.log('now', now);

    // let settingMap = new Map();

    // let settings = this.homey.settings.get('test');
    // this.log('setting', settings);

    // this.homey.settings.get('test');
    // this.log('keys', this.homey.settings.getKeys());

    // this.log('Temp Trappeoppgang', this.homey.settings.get('Temp Trappeoppgang'));

    this.homey.flow.getActionCard('is-alive').registerRunListener(async (value) => {
      
      const now = DateTime.now().setZone(this.homey.clock.getTimezone());
      const aliveTs = DateTime.now().setZone(this.homey.clock.getTimezone()).plus({minutes: value['ttl']});
      const nowStr = now.toFormat("dd.MM.yyyy HH:mm:ss");
      const aliveTsStr = aliveTs.toFormat("dd.MM.yyyy HH:mm:ss");

      try {

        const existingElement = this.homey.settings.get(value['name']);
        if(existingElement !== undefined) {
          //this.log('existingElement=',existingElement);
          if(existingElement.alarm !== undefined && true === existingElement.alarm) {
            this.log('resetter alarm',existingElement.name,'har sjekket inn igjen');
            this.alertflowcard.trigger({'alarm' : existingElement.name + ' har sjekket inn igjen. Alarm er resatt, sist hørt fra: ' + existingElement.ts + ' Neste grenseverdi er ' + aliveTsStr});
          }
        }

      } catch (err) {
        this.log('err', err);
      }
  

      value['ts'] = nowStr;
      value['aliveTs'] = aliveTsStr;
      value['check'] = undefined;
      value['alarm'] = undefined;

      this.log('is live ttl=', value.ttl,  'ts=', value.ts, 'aliveTs=', value.aliveTs, 'check=', value.check, 'value=', value.value, 'valuename=', value.valuename, 'alarm=', value.alarm, 'name=', value.name);
      this.eventflowcard.trigger({'event' : 'is live: ttl=' + value.ttl + ' ts=' + value.ts + ' aliveTs=' + value.aliveTs + ' ' + value.valuename + '='+  value.value + ' name=' + value.name});

      this.homey.settings.set(value['name'], value);


     });


     this.homey.flow.getActionCard('is-below').registerRunListener(async (value) => {
      
      const now = DateTime.now().setZone(this.homey.clock.getTimezone());
      const nowStr = now.toFormat("dd.MM.yyyy HH:mm:ss");
  
      value['ts'] = nowStr;
      value['check'] = undefined;
      value['type'] = 'is-below';
      value['alarm'] = undefined;

      this.log('is below   type=', value.type,  'ts=', value.ts, 'limit=', value.limit, 'check=', value.check, 'value=', value.value, ' ', value.name,);

      this.homey.settings.set(value['name'], value);


     });

     this.homey.flow.getActionCard('is-higher').registerRunListener(async (value) => {
      
      const now = DateTime.now().setZone(this.homey.clock.getTimezone());
      const nowStr = now.toFormat("dd.MM.yyyy HH:mm:ss");
  
      value['ts'] = nowStr;
      value['check'] = undefined;
      value['type'] = 'is-higher';
      value['alarm'] = undefined;

      this.log('is higher   type=', value.type,  'ts=', value.ts, 'limit=', value.limit, 'check=', value.check, 'value=', value.value, ' ', value.name,);

      this.homey.settings.set(value['name'], value);


     });


  }


  
  toDateTimeFromTimestampString(datetimeString) {
    return DateTime.fromFormat(datetimeString,this.timestampFormat,{ zone: this.timeZone });    
  }


  startPolling(seconds) {
    this.clearPolling();

    //const settings = this.getSettings();

    const interval = seconds || 60;

    // start new polling with timeout
    this.pollingTimeout = this.homey.setTimeout(
      () => this.pollTask(),
      1000 * interval
    );
  }  

  clearPolling() {
    if (this.pollingTimeout) {
      this.homey.clearTimeout(this.pollingTimeout);
      this.pollingTimeout = undefined;
    }
  }


  pollTask() {
    const now = DateTime.now().setZone(this.homey.clock.getTimezone());
    this.log('----- poll ----- ' + now.toFormat("dd.MM.yyyy HH:mm:ss"));


    let keys =  this.homey.settings.getKeys();

    const flowcard = this.homey.flow.getTriggerCard('alert');

    for (let index = 0; index < keys.length; index++) {
      const element = this.homey.settings.get(keys[index]);
      //this.log('element', element);
      if(element.aliveTs !== undefined) {
        if( this.toDateTimeFromTimestampString(element.aliveTs) < now && element.check === undefined) {
          this.log('element', element.name, element.aliveTs);
          flowcard.trigger({'alarm' : element.name + ' har ikke sjekket inn siden ' + element.ts + ' Grenseverdi er ' + element.aliveTs});
          element['check'] = true;
          element['alarm'] = true;
          this.homey.settings.set(element['name'], element); // lagrer tilbake
          this.log('is-alive, alarm er clear');
        }
      }
      if(element.type !== undefined) {
        if( 'is-below' === element.type && element.check === undefined && element.value < element.limit) {
          //this.log('element', element.name, element.aliveTs);
          this.log('element', element);
          flowcard.trigger({'alarm' : element.name + ' har verdi ' + element.value + ' som er under grenseverdien på ' + element.limit});
          element['check'] = true;
          this.homey.settings.set(element['name'], element); // lagrer tilbake
          this.log('is-below, alarm er clear');
        }
      }
      if(element.type !== undefined) {
        if( 'is-higher' === element.type && element.check === undefined && element.value > element.limit) {
          //this.log('element', element.name, element.aliveTs);
          this.log('element', element);
          flowcard.trigger({'alarm' : element.name + ' har verdi ' + element.value + ' som er over grenseverdien på ' + element.limit});
          element['check'] = true;
          this.homey.settings.set(element['name'], element); // lagrer tilbake
          this.log('is-higher, alarm er clear');
        }
      }
      
    }

   
    //this.log('----- ---- -----');
    this.startPolling(13);
    //this.startPolling(10);
  }  

}

module.exports = EasyWatchAndAlert;
