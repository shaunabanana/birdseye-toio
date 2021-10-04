const { Cube } = require('@toio/cube')
const noble = require('@abandonware/noble');
const { WebSocketServer, WebSocket } = require('ws');
const KalmanFilter = require('kalmanjs');


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

    constructor(bypassWebSocket) {
        this.cubes = {};
        this.events = [];

        // Kalman filters to deal with noise in toio sensing
        this.xFilter = new KalmanFilter();
        this.yFilter = new KalmanFilter();
        this.angleFilter = new KalmanFilter();

        this.server = new WebSocketServer({ port: 8175 });

        this.connect();

        this.server.on('connection', () => {
            console.log('A WebSocket client connected.');
            for (let cube of Object.keys(this.cubes)) {
                this.broadcast({
                    'event': 'toio:connect',
                    'name': cube
                })
            }
        });
        
    }

    broadcast(message) {
        this.server.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    connect() {
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
                let cubeObject = {
                    name: cube.peripheral.advertisement.localName,
                    control: cube,
                    orientation: 1,
                    x: 0,
                    y: 0,
                    angle: 0,
                    lastUpdate: 0
                };
                this.cubes[cube.peripheral.advertisement.localName] = cubeObject;
                this.registerEventHandlers(cubeObject);
                console.log('Connected to cube', cube.peripheral.advertisement.localName);
                this.broadcast({
                    'event': 'toio:connect',
                    'name': cubeObject.name
                })
            }
        });
    }

    registerEventHandlers(cube) {
        cube.control.on('id:position-id', data => {
            this.onMove(cube, data);
        });
        cube.control.on('sensor:orientation', data => {
            cube.orientation = data.orientation
        });
        cube.control.on('sensor:double-tap', this.onDoubleTap.bind(this, cube));
        // cube.control.on('sensor:slope', data => console.log(data));
        // cube.control.on('sensor:collision', data => console.log(data));
    }

    onDoubleTap(cube) {
        let eventTime = Date.now();
        this.events.push({
            time: eventTime,
            type: 'sensor:double-tap',
            cube: cube.name
        })
        for (let event of this.events) {
            if (event.cube !== cube.name
                && event.type === 'sensor:double-tap'
                && Math.abs(event.time - eventTime) < 100) {

                if (this.cubes[event.cube].orientation === 1 && this.cubes[cube.name].orientation === 1) {
                    console.log('Linking', event.cube, 'and', cube.name);
                    this.broadcast({
                        'event': 'toio:link',
                        'from': event.cube,
                        'to': cube.name,
                    })
                } else if (this.cubes[event.cube].orientation === 2 && this.cubes[cube.name].orientation === 1) {
                    console.log('Emptying', event.cube, 'on', cube.name);
                    this.broadcast({
                        'event': 'toio:empty',
                        'from': event.cube,
                        'to': cube.name,
                    })
                } else if (this.cubes[event.cube].orientation === 1 && this.cubes[cube.name].orientation === 2) {
                    console.log('Emptying', cube.name, 'on', event.cube);
                    this.broadcast({
                        'event': 'toio:empty',
                        'from': cube.name,
                        'to': event.cube,
                    })
                }
                this.events = [];
                return;
            }
        }

        setTimeout(() => {
            if (this.events.length === 0) return;
            for (let event of this.events) {
                if (event.cube !== cube.name
                    && event.type === 'sensor:double-tap'
                    && Math.abs(event.time - eventTime) < 100) {
                    this.events = [];
                    return;
                }
            }
            console.log('Double-tapping', cube.name);
            this.broadcast({
                'event': 'toio:expand',
                'cube': cube.name
            })
        }, 100);
    }

    onMove(cube, data) {
        cube.x = this.xFilter.filter(data.x);
        cube.y = this.yFilter.filter(data.y);
        cube.angle = this.angleFilter.filter(data.angle);

        this.broadcast({
            'event': 'toio:move',
            'cube': cube.name,
            'x': cube.x, 'y': cube.y, 
            'angle': cube.angle
        })
    }

}


manager = new CubeManager();