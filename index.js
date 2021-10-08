const { Cube } = require('@toio/cube')
const noble = require('@abandonware/noble');
const { WebSocketServer, WebSocket } = require('ws');
const KalmanFilter = require('kalmanjs');
const Controller = require('node-pid-controller');


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
    // WidthScale: 1080 * 1.414,
    // HeightScale: 1080
    WidthScale: 1,
    HeightScale: 1
}


class CubeManager {

    constructor(bypassWebSocket) {
        this.cubes = {};
        this.events = [];

        this.server = new WebSocketServer({ port: 8175 });

        this.connect();

        this.server.on('connection', connection => {
            console.log('A WebSocket client connected.');
            for (let cube of Object.keys(this.cubes)) {
                this.broadcast({
                    'event': 'toio:connect',
                    'name': cube
                })
            }
            connection.on('message', this.parseMessage.bind(this));
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

            let cubeObject = {
                name: cube.peripheral.advertisement.localName,
                control: cube,
                orientation: 1,
                x: 0,
                y: 0,
                angle: 0,
                rotating: false,
                target: 0,
                speed: 0,
                direction: 1,
                active: false,
                deactivateTimer: null,
                xFilter: new KalmanFilter(),
                yFilter: new KalmanFilter(),
                angleFilter: new KalmanFilter(),
                controller: null,
            };
            this.cubes[cube.peripheral.advertisement.localName] = cubeObject;
            this.registerEventHandlers(cubeObject);
            console.log('Connected to cube', cube.peripheral.advertisement.localName);
            this.broadcast({
                'event': 'toio:connect',
                'name': cubeObject.name
            })
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
        // cube.control.on('id:position-id-missed', () => {
        //     cube.deactivateTimer = setTimeout(() => {
        //         console.log('Cube deactivated:', cube.name);
        //         cube.active = false;
        //         this.broadcast({
        //             'event': 'toio:deactivate',
        //             'cube': cube.name
        //         })
        //     }, 10000)
        // });
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
                    console.log('Dumping', event.cube, 'on', cube.name);
                    this.broadcast({
                        'event': 'toio:dump',
                        'from': event.cube,
                        'to': cube.name,
                    })
                    this.broadcast({
                        'event': 'toio:deactivate',
                        'cube': event.cube
                    });
                    this.cubes[event.cube].active = false;
                } else if (this.cubes[event.cube].orientation === 1 && this.cubes[cube.name].orientation === 2) {
                    console.log('Dumping', cube.name, 'on', event.cube);
                    this.broadcast({
                        'event': 'toio:dump',
                        'from': cube.name,
                        'to': event.cube,
                    });
                    this.broadcast({
                        'event': 'toio:deactivate',
                        'cube': cube.name
                    });
                    cube.active = false;
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
            if (cube.orientation === 1) {
                console.log('Double-tapping', cube.name);
                this.broadcast({
                    'event': 'toio:expand',
                    'cube': cube.name
                })
            } else if (cube.orientation === 2) {
                console.log('Deactivating all cubes');
                for (let cubeName of Object.keys(this.cubes)) {
                    this.cubes[cubeName].active = false;
                    this.cubes[cubeName].control.playPresetSound(0);
                }
                this.broadcast({
                    'event': 'toio:reset'
                });
            }
            
        }, 100);
    }

    onMove(cube, data) {
        // cube.x = this.xFilter.filter(data.x);
        // cube.y = this.yFilter.filter(data.y);
        // cube.angle = this.angleFilter.filter(data.angle);

        // cube.x = (data.x - 98) / (402 - 98);
        // cube.y = (data.y - 142) / (358 / 142);

        cube.x = cube.xFilter.filter(data.x);
        cube.y = cube.yFilter.filter(data.y);
        cube.angle = data.angle;

        if (!cube.active) {
            console.log('Cube activated:', cube.name);
            cube.active = true;
            this.broadcast({
                'event': 'toio:activate',
                'cube': cube.name
            })
        }

        this.broadcast({
            'event': 'toio:move',
            'cube': cube.name,
            'x': cube.x * ToioConstants.WidthScale, 'y': cube.y * ToioConstants.HeightScale, 
            'angle': cube.angle,
            'moving': cube.moving
        })

        if (cube.deactivateTimer) {
            clearTimeout(cube.deactivateTimer);
            cube.deactivateTimer = null;
        }

        if (cube.moving) {
            console.log('keep rotating', cube.name);
            let difference = this.angleDifference(cube.angle, cube.target);
            let speed = cube.controller.update(difference);
            if (Math.abs(speed) < 8 && Math.abs(speed) > 3) {
                speed = speed / Math.abs(speed) * 8;
            }
            console.log(speed);
            cube.control.move(-speed, speed, 1);

            if (Math.abs(speed) < 5) {
                console.log('stop moving', cube.name);
                cube.moving = false;
            }

            // if (Math.abs(cube.target - cube.angle) <= 10) {
            //     // console.log('stopping');
            //     // cube.control.stop();
            //     // cube.moving = false;
            // } else {
            //     let speed = this.calculateSpeed(cube.angle, cube.target);
            //     // cube.control.move(-speed, speed, 2);
            // }
        }
    }

    parseMessage(message) {
        message = JSON.parse(String(message));
        let cube = this.cubes[message.cube];
        this.rotateTo(cube, message.angle);
    }

    angleDifference(current, target) {
        let difference = target - current;
        if (difference > 180) difference -= 360;
        else if (difference < -180) difference += 360;
        return difference;
    }

    calculateSpeed(current, target) {
        let difference = this.angleDifference(current, target);
        console.log(current, target, difference);
    }

    rotateTo(cube, target) {
        console.log('rotating', cube.name, target);
        cube.target = target;   // The cube almost consistently stop early by -4.
        cube.controller = new Controller(0.35, 0.01, 0);
        cube.controller.setTarget(0);
        cube.moving = true;
    }

}


manager = new CubeManager();