const { Cube } = require('@toio/cube')
const noble = require('@abandonware/noble');


let ToioConstants = {
    Cube: '10b201005b3b45719508cf3efcd7bbae',
    Identity: '10b201015b3b45719508cf3efcd7bbae',
    Sensor: '10b201065b3b45719508cf3efcd7bbae',
    Button: '10b201075b3b45719508cf3efcd7bbae',
    Battery: '10b201085b3b45719508cf3efcd7bbae',
    Motor: '10b201025b3b45719508cf3efcd7bbae',
    Light: '10b201035b3b45719508cf3efcd7bbae',
    Sound: '10b201045b3b45719508cf3efcd7bbae',
    Config: '10b201ff5b3b45719508cf3efcd7bbae',
}


class CubeManager {

    constructor () {
        this.cubes = {};

        noble.on('stateChange', state => {
            if (state === 'poweredOn') {
                console.log('BLE module powered on. Scanning for TOIO robots...')
                noble.startScanning([ToioConstants.Cube], false);
            }
        });

        noble.on('discover', async (peripheral) => {
            let cube = new Cube(peripheral);
            await cube.connect();
            
            if (!this.cubes[cube.peripheral.advertisement.localName]) {
                this.cubes[cube.peripheral.advertisement.localName] = cube;
                cube.on('sensor:orientation', data => console.log(data));
                cube.on('sensor:double-tap', data => console.log('Double tap'));
                cube.on('sensor:slope', data => console.log(data));
                cube.on('sensor:collision', data => console.log(data));
                console.log('Connected to cube', cube.peripheral.advertisement.localName);
            }
        });
    }

}


manager = new CubeManager();