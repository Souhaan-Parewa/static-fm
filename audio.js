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
        for(let i= 0; i< samples; i++){
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

        const bp1= ctx.createBiquadFilter();
        bp1.type= 'bandpass';
        bp1.frequency.value= 1200;
        bp1.Q.value= 0.4;

        const bp2= ctx.createBiquadFilter();
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

    function stopStatic(){
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
        const buf= makeNoiseBufferSource(0.3);
        const src= ctx.createBufferSource();
        src.buffer= buf;

        const g= ctx.createGain();
        g.gain.setValueAtTime(0, now());

        const g= ctx.createGain();
        g.gain.setValueAtTime(0, now());
        g.gain.linearRampToValueAtTime(1.4, now() + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now() + 0.3);

        const dist= ctx.createWaveShaper();
        dist.curve= makeDistortionCurve(400);

        src.connect(dist);
        dist.connect(g);
        g.connect(masterGain);
        src.start();
        src.stop(now()+ 0.35);
    }

    function makeDistortionCurve(amount){
        const n = 256;
        const curve = new Float32Array(n);
        const deg= Math.PI/180;
        for (let i=0; i<n; i++){
            const x= (i*2)/ n-1;
            curve[i]= ((3 + amount)* x* 20* deg)/ (Math.PI + amount* Math.abs(x));
        }
        return curve;
    }

    function staticSweep(fromVol= 0.3, toVol= 0.05, durationSec= 1.5){
        resume();
        const buf = makeNoiseBuffer(durationSec+ 0.5);
        const src= ctx.createBufferSource();
        src.buffer= buf;

        const g= ctx.createGain();
        g.gain.setValueAtTime(fromVol, now());
        g.gain.linearRampToValueAtTime(toVol, now() + durationSec);

        const bp= ctx.createBiquadFilter();
        bp.type= 'bandpass';
        bp.frequency.setValueAtTime(400, now());
        bp.frequency.linearRampToValueAtTime(2400, now()+ durationSec);
        bp.Q.value= 0.8;

        src.connect(bp);
        bp.connect(g);
        g.connect(masterGain);
        src.start();
        src.stop(now()+ durationSec+ 0.1);
    }

    function drone(baseFreq= 55){
        resume();
        stopDrone();

        const freqs= [baseFreq, baseFreq* 1.003, baseFreq* 0.997];
        const gainVal= 0.12;

        const masterDroneGain= ctx.createGain();
        masterDroneGain.gain.setValueAtTime(0, now());
        masterDroneGain.gain.linearRampToValueAtTime(gainVal, now()+ 2.5);
        masterDroneGain.connect(masterGain);

        freqs.forEach(f => {
            const osc= ctx.createOscillator();
            osc.type= 'sawtooth';
            osc.frequency.value= f;

            const lfo= ctx.createOscillator();
            const lfoGain= ctx.createGain();
            lfo.type= 'sine';
            lfo.frequency.value= 0.08+ Math.random()* 0.05;
            lfoGain.gain.value= 1.2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();

            const lowpass= ctx.createBiquadFilter();
            lowpass.type= lowpass.connect(masterDroneGain);
            lowpass.frequency.value= 300;

            osc.connect(lowpass);
            lowpass.type= 'lowpass';
            osc.start();

            droneNodes.push({osc, lfo, masterDroneGain});
        });
        return masterDroneGain;
    }

    function stopDrone(){
        droneNodes.forEach(n =>{
            try{
                n.masterDroneGain.gain.setTargetAtTime(0, now(), 0.5);
                setTimeout(()=>{
                    try{n.osc.stop(); n.lfo.stop(); }catch(e){}
                }, 800);
            } catch(e) {}
        });
        droneNodes=[];
    }

    function subBass(durationSec= 4){
        resume();
        const osc= ctx.createOscillator();
        osc.type= 'sine';
        osc.frequency.value= 22;

        const g= ctx.createGain();
        g.gain.setValueAtTime(0, now());
        g.gain.linearRampToValueAtTime(0.9, now()+ 0.3);
        g.gain.setValueAtTime(0.9, now()+ durationSec- 0.5);
        g.gain.linearRampToValueAtTime(0, now()+ durationSec);

        osc.connect(g);
        g.connect(masterGain);
        osc.start();
        osc.stop(now()+ durationSec+ 0.1);
    }

    function heartbeat(){
        resume();

        function beat(time, vol){
            const osc= ctx.createOscillator();
            const g= ctx.createGain();
            osc.type= 'sine';
            osc.frequency.setValueAtTime(80, time);
            osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(vol, time+ 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, time+ 0.18);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(time);
            osc.stop(time+ 0.2);
        }

        const t= now();
        beat(t, 0.7);
        beat(t+ 0.15, 0.4);
    }

    function startHeartbeat(bpm=68){
        stopHeartbeat();
        heartbeat();
        const interval= (60/bpm)* 1000;
        heartInterval= setInterval(heartbeat, interval);
    }

    function stopHeartbeat(){
        if (heartInterval){clearInterval(heartInterval); heartInterval=null;}
    }

    function numberBeep(index=0){
        resume();
        const freqs= [440, 523, 392, 349, 466, 415, 370, 494, 554, 622];
        const freq= freqs[index% freqs.length];

        const osc= ctx.createOscillator();
        g.gain.setValueAtTime(0.18, now());
        g.gain.setValueAtTime(0.18, now()+ 0.18);
        g.gain.linearRampToValueAtTime(0.0101, now()+ 0.22);

        const bp= ctx.createBiquadFilter();
        bp.type= 'bandpass';
        bp.frequency.value =freq;
        bp.Q.value= 2;

        osc.connect(bp);
        bp.connect(g);
        g.connect(masterGain);
        osc.start();
        osc.stop(now() + 0.25);
    }

    function breatheIn(){
        resume();
        const buf= makeNoiseBuffer(1.2);
        const src= ctx.createBufferSource();
        src.buffer= buf;

        const g= ctx.createGain();
        g.gain.setValueAtTime(0, now());
        g.gain.linearRampToValueAtTime(0.18, now()+ 0.6);
        g.gain.linearRampToValueAtTime(0.001, now()+ 1.1);

        const bp= ctx.createBiquadFilter();
        bp.type= 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 1.5;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value= 500;

        src.connect(bp);
        bp.connect(hp);
        hp.connect(g);
        g.connect(masterGain);
        src.start();
        src.stop(now()+ 1.2);
    }

    function breatheOut(){
        resume();
        const buf= makeNoiseBuffer(1.5);
        const src= ctx.createBufferSource();
        src.buffer = buf;

        const g= ctx.createGain();
        g.gain.setValueAtTime(0.14, now());
        g.gain.linearRampToValueAtTime(0.06, now() + 1.0);
        g.gain.linearRampToValueAtTime(0.001, now() + 1.4);

        const bp= ctx.createBiquadFilter();
        bp.type= 'bandpass';
        bp.frequency.value=600;
        bp.Q.value= 2;

        src.connect(bp);
        bp.connect(g);
        g.connect(masterGain);
        src.start();
        src.stop(now() + 1.5);
    }

    function startBreathing(){
        stopBreathing();
        function cycle(){
            breatheIn();
            setTimeout(breatheOut, 1300);
        }

        cycle();
        breathInterval= setInterval(cycle, 3200);
    }

    function stopBreathing(){
        if (breathInterval){clearInterval(breathInterval); breathInterval=null;}
    }

    function shriek(){
        resume();

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now());
        g.gain.linearRampToValueAtTime(0.85, now() + 0.04);
        g.gain.setValueAtTime(0.85, now() + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, now() + 1.4);
        g.connect(masterGain);

        const osc= ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now());
        osc.frequency.linearRampToValueAtTime(0.85, now() + 0.04);
        osc.frequency.setValueAtTime(0, now() + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, now() + 1.4);
        g.connect(masterGain);

        const mod = ctx.createOscillator();
        const modG= ctx.createGain();
        mod.type= 'square';
        makeDistortionCurve.frequency.value= 47;
        modG.gain.value= 300;
        mod.connect(modG);
        modG.connect(osc.frequency);

        const dist= ctx.createWaveShaper();
        dist.curve= makeDistortionCurve(600);

        osc.connect(dist);
        dist.connect(g);
        osc.start(); osc.stop(now()+ 1.5);
        mod.start(); mod.stop(now()+ 1.5);
    }

    function signalLock(){
        resume();
        const times=[0, 0.22, 0.44, 0.66];
        const freqs= [220, 277, 370, 185];

        times.forEach((t, i)=> {
            const osc= ctx.createOscillator();
            const g= ctx.createGain();
            osc.type= 'sine';
            osc.frequency.value= freqs[i];
            g.gain.setValueAtTime(0.25, now()+ t);
            g.gain.exponentialRampToValueAtTime(0.001, now() + 0.4);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now() + t);
            osc.stop(now()+ t+ 0.45);
        });
    }

    function stopAll(){
        stopDrone();
        stopStatic();
        stopheartbeat();
        stopBreathing();
        try{masterGain.gain.setTargetAtTime(0, now(), 0.3); }catch(e) {}
        setTimeout(()=> {
            try{masterGain.gain.value= 1.0;} catch(e) {}
        }, 500);
    }

    return{
        init,
        resume,
        static: static_,
        stopStatic,
        staticBurst,
        staticSweep,
        drone,
        stopDrone,
        subBass,
        heartbeat,
        startHeartbeat,
        stopHeartbeat,
        numberBeep,
        breatheIn,
        breatheOut,
        startBreathing,
        stopBreathing,
        shriek,
        signalLock,
        stopAll,
    };
})();