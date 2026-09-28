window.SFX= (function(){

    let ctx= null;
    let masterGain= null;

    let droneNodes= [];
    let heartNodes= [];
    let breathNodes= [];
    let staticNodes= [];
    let heartInterval= [];
    let breathInterval= [];

    function init(){
        if (ctx) return;
        ctx= new(window.AudioContext || window.webkitAudioContext)();
        masterGain= ctx.createGain();
        masterGain.gain.value= 1.0;
        masterGain.connect(ctx.destination);
    }

    function resume(){
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function now() {return ctx.currentTime;}

    function makeGain(val){
        const g= ctx.createGain();
        g.gain.value= val;
        g.connect(masterGain);
        return g;
    }

    function makeOsc(type, freq, gainVal, connectTo){
        const osc= ctx.createOscillator();
        const g= ctx.createGain();
        osc.type= type;
        osc.frequency.value= freq;
        
    }
})