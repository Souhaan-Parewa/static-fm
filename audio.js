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
        g.gain.linearRampToValueAtTime(1.4, now() + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now() + 0.3);

        const dist= ctx.createWaveShaper();
        dist.curv= makeDistortionCurve(400);

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
            lfo.type= 0.08 + Math.random()* 0.05;
            lfo.frequency.value= 0.08+ Math.random()* 0.05;
            lfoGain.gain.value= 1.2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();

            const lowpass= ctx.createBiquadFilter();
            lowpass.type= 'lowpass';
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
        stopheartbeat();
        heartbeat();
        const interval= (60/bpm)* 1000;
        heartInterval= setInterval(heartbeat, interval);
    }

    function stopHeartbeat(){
        if (heartInterval){clearInterval(heartInterval); heart=null;}
    }

    function numberBeep(index=0){
        resume();
        const freqs= [440, 523, 392, 349, 466, 415, 370, 494, 554, 622];
        const freq= freqs[index% freqs.length];

        
    }
})