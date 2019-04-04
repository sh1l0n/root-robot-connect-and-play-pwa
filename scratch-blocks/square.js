// Copyright © 2019 Root Robotics, Inc. (http://www.codewithroot.com/) All rights reserved.

'use strict';

////////////////////////////////////////////////////////////////////////
//// SEMANTICS
////////////////////////////////////////////////////////////////////////

// This file contains all the behaviours for each block of the coding space.
class BlockSemantics {
    didModify(statment, environment, calledFromEditor) {}
    didInsert(statment, environment) {}
    didDetach(statment, environment) {}
    didRemove(statment, environment) {}
}

class StatementSemantics extends BlockSemantics {

    run(statment, environment) {};
    stop(statment, environment) {};
}

class StatementSVMSemantics extends StatementSemantics {

    // Must be overridden by the subclasses:
    run(statment, environment) {
        // The equivalent to "do nothing" in the run() method is to at least, return the reference to the next block.
        // Hack: the running mark is not managed by the VM in this case, but by the semantics.
        //statement.view?.showRunningMark()
        let nextBlock = statment.getNextBlock();
        if(nextBlock!=null) {
            environment.semantics[nextBlock.type].run(nextBlock, environment);
        }
        //statement.view?.hideRunningMark()
    };

    /// If overridden by subclasses, be sure to call super.stop():
    stop(statment, environment) {

        var current  = statment;
        while(true) {
            var parent = current.getParent();
            if(parent==null) {
                return;
            }
            environment.semantics[parent.type].stop();
            current = parent;
        }
    };

    getNextOfContainer(statment, environment) {
        var parent = statment.getParent();
        if(parent!=null) {
            return environment.semantics[parent.type].getNextOfContainer(parent);
        }
        return null;
    }
}

class StatementSVMRootV1Semantics extends StatementSemantics {
}

class EventSVMSemantics extends StatementSVMRootV1Semantics {

    constructor(statment) {   
        super();     
        this.event = null;
        this.statment = statment;
    }
    
    stop(statment, environment) {
        super.stop()
        //self?.statement?.view?.hideRunningMark()
    };
    
    didDetach(statment, environment) {
        environment.vm.events.remove(this.event)
    };
}

class RootV1WhenProgramStartsSVMSemantics extends EventSVMSemantics {
    
    didInsert(statment, environment) {  
        this.event = environment.robot.whenProgramStarts( () => {
            let nextBlock = this.statment.getNextBlock();
            if(nextBlock!=null) {
                environment.semantics[nextBlock.type].run(nextBlock, environment);
            }
        });
    };
}

class WhenRootV1BumpersChangeSVMSemantics extends EventSVMSemantics {

    constructor(statment) {
        super(statment);
        this.bumpersTypeToBools = {
            'left': [true, false],
            'any': [true, true],
            'right': [false, true]
        }
    };
     
    parseFromParam(typeBumper) {
        if(this.bumpersTypeToBools[typeBumper]!=null) {
            return this.bumpersTypeToBools[typeBumper];
        }
        return [false, false];
    };

    didInsert(statment, environment) {      
        var value = statment.childBlocks_[0].inputList[0].fieldRow[0].value_;
        this.event = environment.robot.whenBumpers(this.parseFromParam(value), () => {
            let nextBlock = this.statment.getNextBlock();
            if(nextBlock!=null) {
                environment.semantics[nextBlock.type].run(nextBlock, environment);
            }
        });
    };
    
    didModify(statment, environment, calledFromEditor) {        
        var value = statment.inputList[0].fieldRow[0].value_;
        this.event.condition = this.parseFromParam(value)
    };
}

class RootV1MoveSVMSemantics extends StatementSVMRootV1Semantics {

    run(statment, environment) {
        let cm = statment.getInputTargetBlock('CM').getFieldValue('NUM');

        var completion = () => {};
        let nextBlock = statment.getNextBlock();
        if(nextBlock!=null) {
            completion = () => {
                environment.semantics[nextBlock.type].run(nextBlock, environment);
            }
        }
        environment.robot.move(cm, completion);
    };
}

class RootV1RotateSVMSemantics extends StatementSVMRootV1Semantics {

    run(statment, environment) {

        let degs = statment.getInputTargetBlock('DEGS').getFieldValue('NUM');

        var completion = () => {};
        let nextBlock = statment.getNextBlock();
        if(nextBlock!=null) {
            completion = () => {
                environment.semantics[nextBlock.type].run(nextBlock, environment);
            }
        }
        environment.robot.rotate(degs, completion);
    };
}

class ControlWaitSVMSemantics extends StatementSVMRootV1Semantics {

    run(statment, environment) {

        let seconds = statment.getInputTargetBlock('DURATION').getFieldValue('NUM');

        var completion = () => {};
        let nextBlock = statment.getNextBlock();
        if(nextBlock!=null) {
            completion = () => {
                environment.semantics[nextBlock.type].run(nextBlock, environment);
            }
        }
        environment.robot.wait(seconds, completion);
    };
}

class ControlRepeatSVMSemantics extends StatementSVMRootV1Semantics {

    constructor() {
        super();
        this.iterations = 0;
        this.maxIterations = 0;

    }
    
    resetIterations() {
        this.iterations = 0
        this.maxIterations = 0
    }

    run(statment, environment) {

        if(this.maxIterations==0) {
            this.maxIterations = parseInt(statment.getInputTargetBlock('TIMES').getFieldValue('NUM'));
        }

        if(this.iterations<this.maxIterations) {
            this.iterations+=1;

            let firstOnSubstack = statment.getInputTargetBlock('SUBSTACK');
            if(firstOnSubstack!=null) {
                environment.semantics[firstOnSubstack.type].run(firstOnSubstack, environment);
            }

            super.run(statment, environment);
            return;
        }

        let nextBlock = statment.getNextBlock();
        if(nextBlock!=null) {
            environment.semantics[nextBlock.type].run(nextBlock, environment);
        }
    };

    stop(statment, environment) {
        super.stop()
        //self?.statement?.view?.hideRunningMark()
        this.resetIterations();
    };

    getNextOfContainer(statment) {
        this.resetIterations()

        if(this.iterations<this.maxIterations) {
            return statment;
        }
        resetIterations();

        // If next is nil, this may still be a nested block, so it needs to go back recursively gi
        if(statment.getNextBlock()!=null) {
            return statment.getNextBlock();
        }
        else {
            return super.getNextOfContainer();
        }
    }
}

////////////////////////////////////////////////////////////////////////
//// COMMON
////////////////////////////////////////////////////////////////////////

// As same  of common/common.dart runInifiniteLoop function but in JS.
function runInifiniteLoopJS(ms, runCondition, runCode, stopCode) {
    if (runCondition()) {
        runCode();
        setTimeout(function() {
            runInifiniteLoopJS(ms, runCondition, runCode, stopCode);
        }, ms);
    }
    else {
        stopCode();
    }
}

function runTimeoutLoopJS(timeout, ms, runCondition, runCode, stopCode) {
    if (runCondition() && timeout>0) {
        runCode();
        setTimeout(function() {
            runTimeoutLoopJS(timeout - ms, ms, runCondition, runCode, stopCode);
        }, ms);
    }
    else {
        stopCode();
    }
}

////////////////////////////////////////////////////////////////////////
//// EVENT SYSTEM
////////////////////////////////////////////////////////////////////////

// Event constants
const eventsManagerIdleEventEventSource = "eventsManagerIdleEventEventSource";
const eventsRootHALBumpersEventSource = "rootHALBumpersEventSource";
const softwareEventProgramStartedEventSource = "softwareEventProgramStartedEventSource";

// RootEvents is a component, meant to be used by libraries like the RootSDK, or by the SquareLanguage Virtual Machine, but it does not belong to any of them. It is a general events subsystem, just that.
/// This class is just a specification of what an Event must have in order o work with the EventsManager
class Event {

    constructor() {
        this.source = null;
    
        this.isRunning = false; // { didSet { print ("event.isRunning = \(isRunning))") } } // DEBUG.
        
        /// This is a special property that will be false in most events, except in special cases where some events are triggered by themselves (like SquareBlocks' boomerangs), etc.
        this.forceRun = false;
            
        /// Some events may want to be able to interrupt to themselves, but most of them not:
        this.allowSelfInterruption = false;
        
        /// Condition to be used by the test function.
        this.condition = null;
    
        /// Data to be evaluated by the test function.
        this.data = null;
    
        /// Function to be used to evaluate the data.
        this.testFunction = function(event){ return false};
        
        /// Function to be ran if the event is triggered.
        this.task = function(){};
    
        /// Function to be ran just before the event begins.
        this.onEnter = function(){};
    
        /// Function to be ran if the event is stopped.
        this.onStop = function(){};
    }
}

class EventsManager {

    constructor() {
        this.storage = [];
        this.currentEvent = null;
        this.isRunning = false;
        this.infiniteLoopInternvalTimeout = 100.0

        this.createEvent(eventsManagerIdleEventEventSource,  //source
            null,  // condition
            () => { return true },  // testFunction
            () => { },  // task
            () => { },  // onEnter
            () => { }); // onStop
        
        this.setCurrentEventToIdle();
    };

    printEvents() {
        console.log(this.storage);
    };

    idleEvent() {
        let index = this.storage.length - 1;
        if(index >= 0) {
            if(this.storage.length > index) { // Not necessary, but offers extra safety.
                return this.storage[index];
            }
        }
        return null;
    };

    remove(event) {
        const index = this.storage.indexOf(event);
        this.storage.splice(index, 1);
    };

    setCurrentEventToIdle() {
        // This line is here in order to prevent some edge case problems with the lockEvents block: This automatically unlocks things if the system goes to idle. This situation happens for example, if there lockEvents block with children, and the user drags these children out of the lockEvents container while these are running, emptying it:
        this.isRunning = true;
        this.currentEvent = this.idleEvent();
    };

    insertAsHead(event) {
        this.storage.unshift(event);
    };

    insertAsTail(event) {
        this.storage.push(event);
    };

    createEvent(source, condition, testFunction, task, onEnter, onStop) {
        let event = new Event();
        event.source = source;
        event.condition = condition;
        event.testFunction = testFunction;
        event.task = task;
        event.onEnter = onEnter;
        event.onStop = onStop;
        
        this.insertAsHead(event);
        
        return event
    };

    removeAll() {
        let idleEvent = this.idleEvent();
        this.storage.removeAll();
        this.insertAsHead(idleEvent);
    };

    run(event) {
        event.isRunning = true;
        
        try {
            event.onEnter();
            event.task();
        }
        catch {
            // Although all the robot's actions can be interrupted inside an event, since the waiting/timeout loops are controlled the SDK, if there are user's constructions like 2 or more consecutive loops (being them while, for, etc.), or a loop followed by several non-robot commands, then if the isCurrentEventRunning property is propperly used, this exception based system will be able to stop the whole event.
            console.log("---- ", event.source, "INTERRUPTED ----"); // DEBUG.
        }
    };

    stop(event) {
        event.isRunning = false;
        event.onStop();
    };

    arbitrate(source, data) {
        if(!this.isRunning) {
           return; 
        }

        for(var i=0; i<this.storage.length; i++) {
            const event = this.storage[i];
            // Will only evaluate the stored events that belongs to the incoming event's source:
            if(event.source == source) {
                event.data = data;
                // An event can not interrupt itself, unless its allowSelfInterruption flag is true:
                if(event.allowSelfInterruption || event != this.currentEvent) {
                    if(event.testFunction(event)) {
                        return event;
                        break
                    }
                }
            }
        }
        return null;
    };
}

////////////////////////////////////////////////////////////////////////
//// VIRTUAL MACHINE
////////////////////////////////////////////////////////////////////////

class SquareVM {
    
    constructor() {
        this.events = new EventsManager();
        this.isRunning = false;
        this.isPaused = false;
        this.canStepForward = true;
        this.lastRanBlock = null;
        this.didStop = function() {};
    }

    run() {

        if(this.isRunning){
            return
        }

        // Enables the events system, just in case it was disabled before:
        this.events.isRunning = true;
        
        var lastRanEvent = this.events.idleEvent();
            
        // The lastRanBlock must be reinitialized from run to run of the VM. Otherwise, its stop method will be called.
        this.isRunning = true;

        runInifiniteLoopJS(8, 
            ()=> { //runCondition
                // Only runs the event if it is not already running (note that this does not prevent the current event to be changed by the EventsManager to a new, not-yet-running event):
                return this.isRunning;
            }, 
            ()=>{ //runCode()
                if(!this.events.currentEvent.isRunning) {

                    // Only runs the event if it has changed since the last iteration (unless it has interrupted itself):
                    if(lastRanEvent !== this.events.currentEvent || this.events.currentEvent.forceRun) {
                        lastRanEvent = this.events.currentEvent;

                        if(lastRanEvent != null) {
                            // Setting this flag HERE is critical for the boomerangs to work properly:
                            lastRanEvent.forceRun = false;
                            this.events.run(lastRanEvent);
                        }
                        
                        // Was the event interrupted by another incoming event since the call to this.events.run(event:)? If that happened, then this comparison will be false, and thus the lastRanEvent did not finish, which means that there is no need of pointing the currentEvent to the idle one:
                        if(lastRanEvent == this.events.currentEvent && !lastRanEvent.forceRun) {
                            this.events.setCurrentEventToIdle()
                        }
                    }
                } 
            }, 
            ()=>{ //stopCode()
            }
        );
    }

    runBlock(statement) {
        var next = statement;
        
        while(next!=null) {
            if(this.isRunning && this.events.currentEvent != null && this.events.currentEvent.isRunning) {
                return;
            }
            //showRunningMark(visible: true, forBlock: statement)
            next = stepForward(statement);
            // This is necessary to hide the last statement of an event. Otherwise, its running mark will persist when the system goes to idle:
            //showRunningMark(visible: false, forBlock: lastBlockShowingRunningMark)
        }
    }

    stepForward(statement) {
        if(!this.isRunning) {
            return null;
        }

        this.canStepForward = true;
        var nextBlock = semantics[lastRanBlock.type].run(statement, null); //robot
        this.lastRanBlock = statement

        var nextContainer = environment.semantics[statement.type].getNextOfContainer();

        if(nextBlock!=null) {
            return nextBlock;
        }
        else if(nextContainer!=null){
            return nextContainer;
        }
        else {
            return null;
        }
    }

    stop() {
         
        this.isRunning = false;
        
        this.events.stop(this.events.currentEvent);
        //environment.semantics[lastRanBlock.type].stop();
        this.lastRanBlock = null;
        this.events.setCurrentEventToIdle();
        
        this.didStop();
    }
}

////////////////////////////////////////////////////////////////////////
//// ENVIRONMENT
////////////////////////////////////////////////////////////////////////

class Environment {

    constructor() {
        this.workspace = null;
        this.vm = new SquareVM();
        this.robot = new Root(this.vm);
        this.blocks = {};

        this.semantics = {
            // Events
            'event_whenflagclicked' : new RootV1WhenProgramStartsSVMSemantics(),
            'event_whenBumpersPressed' : new WhenRootV1BumpersChangeSVMSemantics(),
        
            // Commands
            'move': new RootV1MoveSVMSemantics(),
            'rotate': new RootV1RotateSVMSemantics(),
        
            // Flow Control
            'control_forever': new StatementSVMSemantics(),
            'control_repeat': new ControlRepeatSVMSemantics(),
            'control_wait': new ControlWaitSVMSemantics()
        }
    };


    onWorkspaceChangeListener(event) {

        var block = environment.workspace.getBlockById(event.blockId);

        switch(event.type) {
            case Blockly.Events.CREATE: 
                switch(block.type) {
                    case 'event_whenflagclicked':
                        environment.blocks[event.blockId] = new RootV1WhenProgramStartsSVMSemantics(block);
                        environment.blocks[event.blockId].didInsert(block, environment);
                    break;
                    case 'event_whenBumpersPressed':
                        environment.blocks[event.blockId] = new WhenRootV1BumpersChangeSVMSemantics(block);
                        environment.blocks[event.blockId].didInsert(block, environment);
                    break;
                }
                
                break;

            case Blockly.Events.DELETE: 
                switch(block.type) {
                    case 'event_whenBumpersPressed':
                        environment.blocks[event.blockId].didDetach(block, environment);
                    break;
                }
                delete environment.blocks[event.blockId];
                break;

            case Blockly.Events.CHANGE: 
                switch(block.type) {
                    case 'dropdown_bumpers':
                        environment.blocks[block.parentBlock_.id].didModify(block, environment, true);
                    break;
                }
                break;
        }

        environment.vm.events.printEvents();
    }
}

////////////////////////////////////////////////////////////////////////
//// ROOT ROBOT
////////////////////////////////////////////////////////////////////////
const RP1DeviceIdAbsoluteIndex = 0;
const RP1CommandIdAbsoluteIndex = 1;
const RP1MessageIdAbsoluteIndex = 2;
const bumpersDeviceId = 12;

class Root {

    constructor(eventRunner) {
        this.eventRunner = eventRunner;
        this.acceptsCommands = false;
        this.durationForTimerLoops = 16; //ms
        this.isExecutingCommand = false;
        this.commandStack = [];
        this.RP1MessagePayloadSize = 16;
        this.commandId = 0;
        this.timeoutConstant = 2;

        this.crc_table = [
            0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15,
            0x38, 0x3f, 0x36, 0x31, 0x24, 0x23, 0x2a, 0x2d,
            0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65,
            0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d,
            0xe0, 0xe7, 0xee, 0xe9, 0xfc, 0xfb, 0xf2, 0xf5,
            0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd,
            0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85,
            0xa8, 0xaf, 0xa6, 0xa1, 0xb4, 0xb3, 0xba, 0xbd,
            0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2,
            0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea,
            0xb7, 0xb0, 0xb9, 0xbe, 0xab, 0xac, 0xa5, 0xa2,
            0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a,
            0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32,
            0x1f, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0d, 0x0a,
            0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42,
            0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a,
            0x89, 0x8e, 0x87, 0x80, 0x95, 0x92, 0x9b, 0x9c,
            0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4,
            0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec,
            0xc1, 0xc6, 0xcf, 0xc8, 0xdd, 0xda, 0xd3, 0xd4,
            0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c,
            0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44,
            0x19, 0x1e, 0x17, 0x10, 0x05, 0x02, 0x0b, 0x0c,
            0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34,
            0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b,
            0x76, 0x71, 0x78, 0x7f, 0x6a, 0x6d, 0x64, 0x63,
            0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b,
            0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13,
            0xae, 0xa9, 0xa0, 0xa7, 0xb2, 0xb5, 0xbc, 0xbb,
            0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8d, 0x84, 0x83,
            0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb,
            0xe6, 0xe1, 0xe8, 0xef, 0xfa, 0xfd, 0xf4, 0xf3
        ];

        this.runCondition = () => { 
            return !this.acceptCommands; 
        };

        // ##EVAL
        //runInifiniteLoop(Duration(milliseconds: 8), () { return true; }, executeNextCommand, (){});
    }

    whenProgramStarts(task) {
        return this.eventRunner.events.createEvent(softwareEventProgramStartedEventSource, null, () => { return true}, task, this.onEnter, this.onStop);
    }

    bumpersTest(event) {
        const leftBumper = (event.data[0] == event.condition[0]);
        const rightBumper = (event.data[1] == event.condition[1]);
        return leftBumper && rightBumper;
    }

    whenBumpers(states, task) {
        return this.eventRunner.events.createEvent(eventsRootHALBumpersEventSource, states, this.bumpersTest, task, this.onEnter, this.onStop);
    }

    run() {        
        // ##TODO: enable events on the physical robot if necessary.
        this.eventRunner.run();
    }
    
    stop() {
        this.eventRunner.stop();
        this.halt();
        sendCommand([0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }

    stopAll() {
        this.eventRunner.stop()
    }

    onEnter() {
        // This is necessary in order to stop, at the beginning of each new event, potentially ongoing long commands (such as move, rotate, etc.). Note that the stopCurrentCommand function does not stop anything that is not already running (see the comments on its declaration). This means that this is an efficient way of stopping ongoing things. This is a critical call, since the whole new event's response will not start until everything is stopped in the robot, so the right place for doing it (from an EventsManager perspective) is here, at the beginning of the new event, given that the fast stop of the long commands loops has already been done, when this is called, on the onStop method of the previous current event. So once the EventsManager has switched to the new one, just before executing the task callback, the onEnter callback is called and this is the prefect place (not just theoretical, but also measured) in order to stop everything and still achieve fast event response times.
        this.stopCurrentCommand();
    }

    onStop() {
        this.acceptsCommands = true;
    }
    
    // MARK: Convenience methods to expose eventsRunner's own methods but with shorter syntax:
    
    /// When using the SDK as a raw API for working with the robot in an event oriented way, this flag can replace a "true" as the condition for infinite loops like "while true", so these loops can be interrupted by the events system. NOTE: If these loops are using any of the robot's commands, then the flag is not needed, as each of these commands can throw an exception and stop any level of outer nested loops when a new events comes. But if there are user's loops that do not deal internally with any robot's command, then adding this to the loop's condition is the way to go.
    isCurrentEventRunning() {
        return this.eventRunner.events.isCurrentRunning;
    }
    
    /// This method can be used as a guard in for loops and recursive functions running inside an event (whenXX methods) in order to stop it if there is another incoming event. NOTE: See the note in the isCurrentEventRunning flag above, about loops using robot's commands.
    stopIfCurrentIsNotRunning() {
        this.eventRunner.events.stopIfCurrentIsNotRunning();
    }

    _stopAll() {        
        this.stopAll()
        // ##TODO: Stop the events system too and test that everything works as before.
    }
    
    
    /// NOTE: It's important to stop all the robot's subsystems here. So if in the future more components are added to this class, they must be stopped here.
    stopCurrentCommand() {
        // The system now can accept new commands:
        this.acceptsCommands = true
    }

    toByteArray(data) {
        var result = [0, 0, 0, 0];
        result[0] = parseInt((data >> 24) & 0xff);
        result[1] = parseInt((data >> 16) & 0xff);
        result[2] = parseInt((data >> 8) & 0xff);
        result[3] = parseInt(data & 0xff);
        return result
    }

    incrementCommandId() {
        this.commandId += 1;
        if(this.commandId>255) {
            resetCommandId();
        }
    }

    resetCommandId() {
        this.commandId = 0;
    }

    computeCRC(data) {
        var crc = 0;
        
        for(var i=0; i<data.length; i++) {
            let d = data[i];
            let index = parseInt(crc ^ d);
            crc = index < this.crc_table.length ? this.crc_table[index] & 0xff : 0;
        }

        crc = crc & 0xff;
        
        return crc;
    }

    executeNextCommand() {
        if(!this.commandStack.isEmpty){
            if(!this.isExecutingCommand){
                this.commandStack[0]();
                this.commandStack.splice(0, 1);
            }
        }
    }

    addToStack(code) {
        this.commandStack.push(code);
        this.executeNextCommand();
    }
    
    halt() {
        this.acceptsCommands = true
        this.commandStack = [];
        // ##EVAL: If the id returned will be processed in order to resend the command if not received, since the stopAll is a critical command which execution must be ensured.
        //this._stopAll()
    }

    move(cm, completion) {
        
        var code = () => {
            this.isExecutingCommand = true;
            this.acceptCommands = false;

            let mm = Math.abs(cm*10) < Number.MAX_SAFE_INTEGER ? cm*10 : 0;
            let speed = 0; // mm/s
            let units = 0 // mm
            
            let commandData = this.toByteArray(mm).concat(speed).concat(units);
            var payload = [this.commandId].concat(commandData);
            var fillZerosCount = this.RP1MessagePayloadSize - payload.length + 1;
            payload = payload.concat(new Array(fillZerosCount).fill(0, 0, fillZerosCount));
            let dataForChecksum = [1, 8].concat(payload);
            let data = dataForChecksum.concat(this.computeCRC(dataForChecksum));
            let timeoutMs = (Math.abs(cm)/10)*1000; //10cm/s max speed, 1s=1000ms

            
            var stopCode = () => { 
                this.isExecutingCommand = false;
                if(!this.acceptCommands && completion!=null) {
                    this.acceptCommands = true;
                    completion();
                }
            };

            sendCommand(data);
            this.incrementCommandId();
            runTimeoutLoopJS(timeoutMs, this.durationForTimerLoops, this.runCondition, ()=>{}, stopCode);
        };
        this.addToStack(code);
    }

    rotate(degs, completion) {

        var code = () => {
            this.isExecutingCommand = true;
            this.acceptCommands = false;

            //let tenthOfDeg = abs(angle.degToTenthOfDeg) < CGFloat(Int32.max) ? Int32(angle.degToTenthOfDeg) : 0
            let tenthOfDeg = Math.abs(degs*10) < Number.MAX_SAFE_INTEGER ? degs*10 : 0;
            let speed = 0; // Not used in the current implementation.
            let units = 0; // Not used in the current implementation.
            let turnType = 0; // Not used in the current implementation.
            
            let commandData = this.toByteArray(tenthOfDeg).concat(turnType).concat(speed).concat(units);
            var payload = [this.commandId].concat(commandData);
            var fillZerosCount = this.RP1MessagePayloadSize - payload.length + 1;
            payload = payload.concat(new Array(fillZerosCount).fill(0, 0, fillZerosCount));
            let dataForChecksum = [1, 12].concat(payload);
            let data = dataForChecksum.concat(this.computeCRC(dataForChecksum));
            let timeoutMs = (Math.abs(degs)*0.1)*100; //0.1 rotation speed

            var stopCode = () => { 
                this.isExecutingCommand = false;
                if(!this.acceptCommands && completion!=null) {
                    this.acceptCommands = true;
                    completion();
                }
            };

            sendCommand(data);
            this.incrementCommandId();
            runTimeoutLoopJS(timeoutMs, this.durationForTimerLoops, this.runCondition, ()=>{}, stopCode);
        };
        this.addToStack(code);
    }

    wait(seconds, completion) {
        var code = () => {
            this.isExecutingCommand = true;
            this.acceptCommands = false;

            var stopCode = () => { 
                this.isExecutingCommand = false;
                if(!this.acceptCommands && completion!=null) {
                    this.acceptCommands = true;
                    completion();
                }
            };

            runTimeoutLoopJS(seconds*1000, this.durationForTimerLoops, this.runCondition, ()=>{}, stopCode);
        };
        this.addToStack(code);
    }
}

// Global variable which represents environment
var environment = new Environment();

////////////////////////////////////////////////////////////////////////
//// HIGH LEVEL FUNCTIONS
////////////////////////////////////////////////////////////////////////

function inject(domElement, toolbox, toolboxPosition, scrollbars = true, horizontalLayout = true, trashcan = true, media, rtl = false, sounds = true, zoomControls = false, zoomStartScale = 1.0, zoomMaxScale = 1.0, zoomMinScale = 1.0, zoomScaleSpeed =  1.3) {
        
    if(environment.workspace!=null) {
        return;
    }
    
    var workspaceData = {
        toolbox: Blockly.Blocks.defaultToolboxSimple, //toolbox
        toolboxPosition: toolboxPosition,
        scrollbars: scrollbars,
        horizontalLayout: horizontalLayout,
        trashcan: trashcan,
        media: media,
        rtl: rtl,
        sounds: sounds,
        zoom: {
            controls: zoomControls,
            startScale: zoomStartScale,
            maxScale: zoomMaxScale,
            minScale: zoomMinScale,
            scaleSpeed: zoomScaleSpeed
        }
    }
  
    environment.workspace = Blockly.inject(domElement, workspaceData);    
    environment.workspace.addChangeListener(environment.onWorkspaceChangeListener);
}

function loadXMLProgram(xml) {
    if(environment.workspace!=null) {
      Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), environment.workspace);
    }
}

function _arbitrateEvent(source, data) {
    var event = environment.vm.events.arbitrate(source, data);
    if(event!=null) {
        environment.robot.halt();
        event.task();
    }
}

function run() {
    // Run button behaviour
    environment.robot.halt();
    environment.robot.run();
    _arbitrateEvent(softwareEventProgramStartedEventSource, null);
}

function stop() {
    // Stop button behaviour
    if(environment.vm.isRunning) {
        environment.robot.stop();
    }
}

// This function only filter bumper events
function didReceive(data) {

    if(!environment.vm.isRunning) {
        return;
    }

    var device = parseInt(data[RP1DeviceIdAbsoluteIndex]);
    var command = parseInt(data[RP1CommandIdAbsoluteIndex]);

    // Bumper command parsing
    if(device==bumpersDeviceId) {
      var maxIndex = data.length - 1;
      if(maxIndex > RP1MessageIdAbsoluteIndex){
        var dataEvent = data.slice(RP1MessageIdAbsoluteIndex, maxIndex);
        var tempData = dataEvent.slice(5, 7).reverse();

        var tempStates = [];
        for(var i = 0; i<=1; i++) {
          for(var j = 0; j<=7;  j++) {
              var result = (parseInt(tempData[i]) >> j) & 0x01;
              tempStates.push(result==0x01);
          }
        }
      
        const leftBumper =  tempStates[tempStates.length - 1];
        const rightBumper = tempStates[tempStates.length - 2];
        const bumpersData = [leftBumper, rightBumper];
        _arbitrateEvent(eventsRootHALBumpersEventSource, bumpersData);
      }
    }
}