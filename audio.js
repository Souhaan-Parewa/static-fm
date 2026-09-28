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
        g.gain.value= gainVal;
        osc.connect(g);
        g.connect(connectTo || masterGain);
        return{osc, gain: g};
    }

    function makeBandpass(freq, Q){
        const f= ctx.createBiquadFilter();
        f.type= 'bandpass';
        f.frequency.value= freq;
        f.Q.value= Q;
        f.connect(masterGain);
        return f;
    }

    function makeNoiseBuffer(durationSec){
        const rate= ctx.sampleRate;
        const samples= Math.ceil(rate* durationSec);
        const buffer= ctx.createBuffer(1, samples, rate);
        const data= buffer.getChannelData(0);
        for(let i= 0; i< samples; i==){
            data[i]= Math.random()*2-1;
        }
        return buffer;
    }

    function static_(volume= 0.15){
        resume()
        const buf= makeNoiseBuffer(3);
        const src= ctx.createBufferSource();
        src.buffer= buf;
        src.loop= true;

        const g= ctx.createGain();
        g.gain.value= volume;

        const bp1= ctx.createGain();
        g.gain.value= volume;

        const bp1= ctx.createBiquadFilter();
        bp1.type= 'bandpass';
        bp1.frequency.value= 1200;
        bp1.Q.value= 0.4;

        const bp2.type= ctx.createBiquadFilter();
        bp2.type= 'highpass';
        bp2.frequency.value= 300;

        src.connect(bp1);
        bp1.connect(bp2);
        bp2.connect(g);
        g.connect(masterGain);

        src.start();
        staticNodes.push({src, g});
        return{src, gain: g};
    }

    function stopstatic(){
        staticNodes.forEach(n=> {
            try{
                n.g.gain.setTargetAtTime(0, now(), 0.1);
                setTimeout(() => {try{n.src.stop();} catch(e){} }, 200);
            } catch(e) {}
        });
        staticNodes=[];
    }

    function staticBurst(){
        resume();
        const buf= makeNoiseBufferSource();
        src.buffer= buf;

        const g= ctx.createBufferSource();
        g.gain.setValueAtTime(1.4, now()+ 0.3);

        const g= ctx.createGain();
        g.gain.setValueAtTime(0, now());
        g.gain.lineatRampToValueAtTime(1.4, now() + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now() + 0.3);

        const dist= ctx.create
    }
})