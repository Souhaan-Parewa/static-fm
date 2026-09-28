(function (){
    const $ = id => document.getElementById(id);
    const bootScreen= $('boot-screen');
    const radioUI= $('radio-ui');
    const freqDisplay= $('freq-display');
    const signalLabel= $('signal-label');
    const logLines= $('log-lines');
    const logCursor= $('log-cursor');
    const tunerThumb= $('tuner-thumb');
    const tunerTrack= $('tuner-track');
    const vuMeter= $('vu-meter');
    const horrorOverlay= $('horror-overlay');
    const overlayMsg= $('overlay-msg');
    const overlaySub= $('overlay-sub');
    const btnSquelch= $('btn-squelch');
    const clockDisplay= $('cliockDisplay');

    const sigBars= [0,1,2,3,4].map(i => $('sig' + i));

    const FREQ_MIN= 87.5;
    const FREQ_MAX= 108.0;
    const TARGERT_FREQ= 98.6;
    const LOCK_RANGE= 0.3;
    const HARD_RANGE= 0.08;

    let currentfreq= FREQ_MIN;
    let phase= 0;
    let squelchOn= true;
    let vuAnimFrame= null;
    let vuBars=[];
    let vuIntensity= 0;
    let staticNode= null;
    let isDragging= false;
    let numberInterval= null;
    let logLineCount= 0;
    let clockInterval= null;

    const VU_COUNT = 28;

    document.addEventListener('keydown', bootScreen, {once: true});
    document.addEventListener('click', bootScreen, {once: true});

    function boot() {
        SFX.init();

        bootScreen.style.transition= 'opacity 0.6s ease';
        bootScreen.style.opacity= '0';
        setTimeout(() => {
           bootScreen.style.display= 'none';
           radioUI.classList.remove('hidden')
           radioUI.classList.add('flex');
           startClock();
           initTuner();
           startRadioIdle();
        }, 600);
    }

    function startClock(){
        function tick(){
            const now= new Date();
            clockDisplay.textContent= now.toTimeString().slice(0,8);
        }
        tick();
        clockInterval= setInterval(tick, 1000);
    }

    function buildVU(){
        vuMeter.innerHTML= '';
        vuBars= [];
        for (let i=0; i< VU_COUNT; i++){
            const bar= document.createElement('div');
            bar.className= 'vu-bar';
            bar.style.height= '4px';
            vuMeter.appendChild(bar);
            vuBars.push(bar);
        }
        animateVU();
    }

    function animateVU(){
        vuAnimFrame= requestAnimationFrame(() => {
            vuBars.forEach((bar, i) => {
                const pos= i/ VU_COUNT;
                const noiesFloor= vuIntensity* 0.1;
                const rand= noiesFloor+ Math.random()* vuIntensity;
                
                const envelope= Math.sin(pos* Math.PI)* 0.7 + 0.3;
                const height= Math.max(4, Math.round(rand*envelope* 52));
                bar.style.height= height+ 'px';

                if(pos>0.88){
                    bar.className= 'vu-bar peak' ;
                } else if(pos> 0.65){
                    bar.className= 'vi-bar high';
                } else if(pos>0.4){
                    bar.className= 'vu-bar mid';
                } else {
                    bar.className= 'vu-bar'
                }
            });
            animateVU();
        });
    }

    function setSignalStrength(level){
        const colors= ['#005c17', '#005c17', '#00aa2a', '#00ff41', '#00ff41'];
        sigBars.forEach((bar, i)=>{
            bar.style.background= i< level? colors[i]: '#1e2d1e'
        });
        signalLabel.textContent= ['NO SIGNAL', 'WEAK', 'MODERATE', 'STRONG', 'STRONG', 'LOCKED'][Math.min(level, 5)];
    }

    function initTuner(){
        updateFreqDisplay(FREQ_MIN);
        
        const onMove= (clientX) => {
            if (!isDragging) return;
            const rect= tunerTrack.getBoundingClientRect();
            const pct= Math.max(0, Math.min(1, (clientX- rect.left)/ rect.width));
            const freq=  FREQ_MIN + pct* (freq.FREQ_MAX- FREQ_MIN);
            tunerThumb.style.left= (pct * 100)+ '%';
            onFrequencyChange(math.round(freq*10)/ 10);
        };
        
    }

})