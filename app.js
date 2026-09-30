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
    const clockDisplay= $('clockDisplay');

    const sigBars= [0,1,2,3,4].map(i => $('sig' + i));

    const FREQ_MIN= 87.5;
    const FREQ_MAX= 108.0;
    const TARGET_FREQ= 98.6;
    const LOCK_RANGE= 0.3;
    const HARD_RANGE= 0.08;

    let currentFreq= FREQ_MIN;
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

    document.addEventListener('keydown', boot, {once: true});
    document.addEventListener('click', boot, {once: true});

    function boot() {
        SFX.init();

        bootScreen.style.transition= 'opacity 0.6s ease';
        bootScreen.style.opacity= '0';
        setTimeout(() => {
           bootScreen.style.display= 'none';
           radioUI.classList.remove('hidden')
           radioUI.classList.add('flex');
           startClock();
           buildVU();
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
                const noiseFloor= vuIntensity* 0.1;
                const rand= noiseFloor+ Math.random()* vuIntensity;
                
                const envelope= Math.sin(pos* Math.PI)* 0.7 + 0.3;
                const height= Math.max(4, Math.round(rand*envelope* 52));
                bar.style.height= height+ 'px';

                if(pos>0.88){
                    bar.className= 'vu-bar peak' ;
                } else if(pos> 0.65){
                    bar.className= 'vu-bar high';
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
            const freq=  FREQ_MIN + pct* (FREQ_MAX- FREQ_MIN);
            tunerThumb.style.left= (pct * 100)+ '%';
            onFrequencyChange(Math.round(freq*10)/ 10);
        };

        tunerThumb.addEventListener('mousedown', e=> {isDragging= true; e.preventDefault();});
        tunerThumb.addEventListener('touchstart', e =>{isDragging= true; }, {passive: true});

        document.addEventListener('mousemove', e => onMove(e.clientX));
        document.addEventListener('touchmove', e => onMove(e.touches[0].clientX), {passive: true});

        document.addEventListener('mouseup', ()=> {isDragging= false; });
        document.addEventListener('touchend', ()=> {isDragging= false; });
    }

    function updateFreqDisplay(freq){
        currentFreq= freq;
        freqDisplay.textContent= freq.toFixed(1);
    }

    function onFrequencyChange(freq){
        updateFreqDisplay(freq);
        const dist= Math.abs(freq- TARGET_FREQ);
        
        if(dist< HARD_RANGE){
            if (phase< 2) triggerPhase2();
        } else if(dist< LOCK_RANGE){
            const strength= 1- (dist/LOCK_RANGE);
            vuIntensity= 0.1+ strength* 0.6;
            if (staticNode){
                staticNode.gain.gain.setTargetAtTime(
                    0.3- strength* 0.25, SFX.init() || 0, 0.1
                );
            }
            setSignalStrength(Math.round(strength* 3)+ 1);

            if(phase< 1) triggerPhase1();
        } else{

            vuIntensity= 0.05+ Math.random()* 0.05;
            setSignalStrength(0);
        }
    }
    
    function startRadioIdle(){
        staticNode= SFX.static(0.2);
        vuIntensity= 0.05;
        setSignalStrength(0);

        addLog('RECEIVER ONLINE', 'signal-line');
        addLog('SCANNING FREQUENCIES...', 'static-line');
        addLog('NO SIGNAL DETECTED', 'static-line');
        addLog('--- DRAG TUNER TO SCAN ---', 'static-line');
    }

    function triggerPhase1(){
        if (phase >= 1) return;
        phase= 1;

        SFX.staticSweep(0.2, 0.08, 1.0);
        SFX.signalLock();
        SFX.drone(44);

        vuIntensity= 0.4;
        setSignalStrength(2);

        addLog('', 'static-line');
        addLog('SIGNAL DETECTED...', 'warn-line');
        addLog('UNKNOWN ORIGIN', 'warn-line');
        addLog('', 'static-line');

        let count= 0;
        const numbers= ['SEVEN', 'FOUR', 'ONE', 'NINE', 'FIVE', 'SEVEN', 'ZERO', 'THREE'];
        numberInterval= setInterval(()=> {
            SFX.numberBeep(count);
            addLog(numbers[count% numbers.length], 'signal-line');
            count++;
            if (count>= numbers.length* 2){
                clearInterval(numberInterval); 
            }
        }, 900);

        setTimeout(()=> {
            addLog('', 'static-line');
            addLog('TRANSMISSION SOURCE: UNKNOWN', 'warn-line');
        }, numbers.length* 900+ 200);     
    }

    function triggerPhase2() {
        if (phase >=2) return;
        phase= 2;

        clearInterval(numberInterval);
        SFX.stopDrone();
        SFX.staticBurst();

        setTimeout(() => {
            SFX.drone(36);
            SFX.startBreathing();
            SFX.startHeartbeat(60);
            SFX.subBass(5);

            vuIntensity= 0.85;
            setSignalStrength(5);
            freqDisplay.classList.add('freq-glitch');
            setTimeout(() => freqDisplay.classList.remove('freq-glitch'), 600);

            addLog('', 'static-line');
            addLog('SIGNAL LOCKED: 98.6 MHz', 'red-line');
            addLog('SOURCE: [UNRESOLVABLE]', 'red-line');
            addLog('', 'static-line');

            shakeBody();

            const breathLines= [
                '........',
                '...something is breathing...',
                '...it has been here for a while...',
                '...it knows the signal was opened...',
            ];
            breathLines.forEach((line, i) => {
                setTimeout(() => addLog(line, i> 0? 'red-line': 'static-line'), i* 2400);
            });

            setTimeout(triggerPhase3, breathLines.length* 2400+ 1000);
        }, 400);
    }

    function triggerPhase3(){
        if(phase>= 3) return;
        phase= 3;

        SFX.stopBreathing();
        SFX.stopHeartbeat();
        SFX.subBass(3);

        setTimeout(() => {
            SFX.shriek();
            shakeBody();
            flashBody();

            setTimeout(() => {
                SFX.drone(28);
                SFX.startHeartbeat(110);


                radioUI.style.transition= 'opacity 0.4s';
                radioUI.style.opacity= '0';

                setTimeout(() => {
                    radioUI.style.display= 'none';
                    horrorOverlay.classList.remove('hidden');
                    horrorOverlay.classList.add('flex');
                    revealHorrorText();
                }, 500);
            }, 600);
        }, 800); 
    }
    
    function revealHorrorText() {
        const messages= [
            {label: 'SIGNAL ACQUIRED', text: 'YOU TUNED IN.\n\nIT WAS WAITING FOR SOMEONE TO LISTEN.', sub: '98.6 MHz · TRANSMISSION IN PROGRESS', delay: 0},
            {label: 'SOURCE IDENTIFIED', text: 'THE FREQUENCY HAS ALWAYS BEEN HERE.\n\nYOU JUST COULD NOT HEAR IT BEFORE.', sub: 'DURATION: 00:' + String(Math.floor(Math.random()*59) +1).padStart(2,'0')+ ':' + String(Math.floor(Math.random()*59)).padStart(2,'0'), delay: 5000 },
            {label: 'FINAL BROADCAST', text: 'DO NOT TURN OFF THE RADIO.\n\nDO NOT CLOSE THIS TAB.\n\nIT ALREADY KNOWS WHERE YOU ARE.', sub: 'SIGNAL WILL CONTINUE INDEFINITELY', delay: 10000},
        ];

        messages.forEach(({label, text, sub, delay})=> {
            setTimeout(() => {
                $('overlay-label').textContent= label;
                typeOverlayText(text, sub);
                SFX.staticBurst();
                shakeBody();
            }, delay);
        });
    }

    function typeOverlayText(text, sub){
        overlayMsg.textContent='';
        overlaySub.textContent='';
        let i=0;
        const iv= setInterval(()=> {
            if(text[i] === '\n'){
                overlayMsg.innerHTML += '<br>';
            } else{
                overlayMsg.textContent += text[i];
            }
            i++; 
            if(i >= text.length){
                clearInterval(iv);
                setTimeout(() => {overlaySub.textContent= sub;}, 400);
            }
        }, 55);
    }

    function addLog(text, className= ''){
        logCursor.classList.add('hidden');
        const line= document.createElement('div');
        line.className= 'log-line '+ className;
        line.textContent= text;
        logLines.appendChild(line);
        logLineCount++;

        if (logLineCount> 10){
            const first= logLines.querySelector('.log-line');
            if (first) logLines.removeChild(first);
        }

        const panel= $('log-panel');
        panel.scrollTop= panel.scrollHeight;

        setTimeout(() => logCursor.classList.remove('hidden'), 100);
    }

    window.RADIO= {
        startScan(){
            if (phase >= 2) return;
            addLog('SCANNING...', 'static-line');
            let pct=0;
            const iv= setInterval(() => {
                pct += 0.008;
                if (pct >= 1) pct=0;

                const freq= FREQ_MIN+ pct* (FREQ_MAX- FREQ_MIN);
                tunerThumb.style.left= (pct* 100) + '%';
                onFrequencyChange(Math.round(freq* 10)/ 10);

                if(Math.abs(freq- TARGET_FREQ)< HARD_RANGE) clearInterval(iv);
            }, 50);
        },

        toggleSquelch(){
            squelchOn= !squelchOn;
            btnSquelch.textContent= 'SQUELCH: '+ (squelchOn? 'ON' : 'OFF');
            if (!squelchOn){
                addLog('SQUELCH OFF — RAW SIGNAL', 'warn-line');
                SFX.staticBurst();
            }
        }
    };

    function shakeBody(){
        document.body.classList.remove('do-shake');
        void document.body.offsetWidth;
        document.body.classList.add('do-shake');
        setTimeout(() => document.body.classList.remove('do-shake'), 550);
    }

    function flashBody(){
        document.body.classList.add('red-pulse');
        setTimeout(() => document.body.classList.remove('red-pulse'), 350);
    }

})();