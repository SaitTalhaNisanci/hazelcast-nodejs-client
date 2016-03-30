import net = require('net');
import Q = require('q');
import Address = require('../Address');
import {BitsUtil} from '../BitsUtil';

class ClientConnection {
    address: Address;
    socket: net.Socket;
    lastRead: number;
    heartbeating = true;

    private readBuffer: Buffer;

    constructor(address: Address) {
        this.address = address;
        this.readBuffer = new Buffer(0);
        this.lastRead = 0;
    }

    getAddress(): Address {
        return this.address;
    }

    connect(): Q.Promise<ClientConnection> {
        var ready = Q.defer<ClientConnection>();

        this.socket = net.connect(this.address.port, this.address.host, (e: any) => {

            // Send the protocol version
            var buffer = new Buffer(3);
            buffer.write('CB2');
            this.socket.write(buffer);
            ready.resolve(this);
        });

        this.socket.on('error', (e: any) => {
            ready.reject(e);
        });

        return ready.promise;
    }

    write(buffer: Buffer): Q.Promise<void> {
        var deferred = Q.defer<void>();
        this.socket.write(buffer, 'utf8', (e: any) => {
            if (e === undefined) {
                deferred.resolve();
            } else {
                console.log('Error sending message to ' + this.address + ' ' + e);
                deferred.reject(e);
            }
        });
        return deferred.promise;
    }

    close() {
        this.socket.destroy();
    }

    registerResponseCallback(callback: Function) {
        this.socket.on('data', (buffer: Buffer) => {
            this.lastRead = new Date().getTime();
            this.readBuffer = Buffer.concat([this.readBuffer, buffer], this.readBuffer.length + buffer.length);
            while (this.readBuffer.length >= BitsUtil.INT_SIZE_IN_BYTES ) {
                var frameSize = this.readBuffer.readInt32LE(0);
                if (frameSize > this.readBuffer.length) {
                    return;
                }
                var message: Buffer = new Buffer(frameSize);
                this.readBuffer.copy(message, 0, 0, frameSize);
                this.readBuffer = this.readBuffer.slice(frameSize);
                callback(message);
            }
        });
    }
}

export = ClientConnection
