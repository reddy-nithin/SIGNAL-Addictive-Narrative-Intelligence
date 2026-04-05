// about.js — About page for SIGNAL
// Contains Architecture and the new interactive Radial Orbital Timeline.

const STAGES = [
  {
    id: 1,
    key: 'curiosity',
    name: 'Curiosity',
    color: '#22d3ee',
    description: 'Pre-use interest and questions about substances. The individual is gathering information and evaluating risk.',
    signals: ['What does X feel like?', 'Is it safe to try?', 'Just wondering about…'],
    icon: 'eye',
    energy: 10,
    relatedIds: [2]
  },
  {
    id: 2,
    key: 'experimentation',
    name: 'Experimentation',
    color: '#3b82f6',
    description: 'First or early recreational use. The individual frames use as controlled and voluntary.',
    signals: ['Tried it last weekend', 'Not addicted, just curious', 'First time experience'],
    icon: 'flask-conical',
    energy: 25,
    relatedIds: [1, 3]
  },
  {
    id: 3,
    key: 'regular_use',
    name: 'Regular Use',
    color: '#f59e0b',
    description: 'Patterned, habitual use often rationalized as functional or stress-relieving.',
    signals: ['I use every Friday', 'Helps me deal with work', 'Part of my routine now'],
    icon: 'calendar-clock',
    energy: 45,
    relatedIds: [2, 4]
  },
  {
    id: 4,
    key: 'dependence',
    name: 'Dependence',
    color: '#f97316',
    description: 'Compulsive use with withdrawal symptoms. Tolerance established and daily function impaired.',
    signals: ["Can't function without it", 'Sick when I stop', 'Need it to feel normal'],
    icon: 'pill',
    energy: 70,
    relatedIds: [3, 5]
  },
  {
    id: 5,
    key: 'crisis',
    name: 'Crisis',
    color: '#ef4444',
    description: 'Acute overdose, severe consequences, or rock-bottom events requiring immediate intervention.',
    signals: ['Overdosed last night', 'Lost my job / family', 'In the ER right now'],
    icon: 'activity',
    energy: 100,
    relatedIds: [4, 6]
  },
  {
    id: 6,
    key: 'recovery',
    name: 'Recovery',
    color: '#10b981',
    description: 'Active pursuit of sobriety, treatment engagement, and peer support participation.',
    signals: ['30 days clean today', 'In treatment, taking it day by day', 'My sponsor says…'],
    icon: 'heart-pulse',
    energy: 5,
    relatedIds: [5]
  }
];

const HOW_IT_WORKS = [
  {
    num:   '01',
    title: 'Substance Resolution',
    icon:  '🔬',
    desc:  'Street slang is resolved to clinical entities using three parallel methods that vote on the result.',
    tech:  '3 methods: rule-based lexicon, SBERT embedding similarity, Gemini zero-shot',
    color: '#00d4ff',
  },
  {
    num:   '02',
    title: 'Narrative Stage',
    icon:  '🧭',
    desc:  'Each post is placed on the 6-stage addiction arc — a new classification task not present in prior literature.',
    tech:  '3 methods: keyword + tense rules, fine-tuned DistilBERT, Gemini few-shot',
    color: '#7c3aed',
  },
  {
    num:   '03',
    title: 'Clinical Grounding',
    icon:  '📋',
    desc:  'Resolved substances are looked up in a dual-retrieval knowledge base and FAERS adverse-event signals.',
    tech:  'FAISS dense + BM25 sparse over 84 pharmacology chunks + 310 FAERS signals',
    color: '#f59e0b',
  },
  {
    num:   '04',
    title: 'Analyst Brief',
    icon:  '📡',
    desc:  'Gemini synthesises all layers into a structured, evidence-cited analyst brief for public-health workers.',
    tech:  'Gemini 2.0 Flash via Vertex AI · citations [KB:…] and [FAERS:…] auto-linked',
    color: '#10b981',
  },
];

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHowItWorks() {
  const cardsHtml = HOW_IT_WORKS.map((layer, i) => `
    <div class="glass-card reveal stagger-${i}" style="
      padding: 28px 22px;
      border-top: 3px solid ${esc(layer.color)};
      position: relative;
      flex: 1;
      min-width: 200px;
    ">
      <div style="
        font-size: 1.8rem;
        margin-bottom: 14px;
        filter: drop-shadow(0 0 8px ${esc(layer.color)}60);
      ">${esc(layer.icon)}</div>
      <div class="font-mono" style="
        font-size: 0.65rem;
        color: ${esc(layer.color)};
        letter-spacing: 0.2em;
        text-transform: uppercase;
        margin-bottom: 6px;
      ">LAYER ${esc(layer.num)}</div>
      <h3 class="font-exo" style="
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        margin: 0 0 10px;
      ">${esc(layer.title)}</h3>
      <p style="
        color: rgba(255,255,255,0.55);
        font-size: 0.82rem;
        line-height: 1.6;
        margin: 0 0 14px;
      ">${esc(layer.desc)}</p>
      <div class="font-mono" style="
        font-size: 0.68rem;
        color: rgba(255,255,255,0.3);
        border-top: 1px solid rgba(255,255,255,0.06);
        padding-top: 12px;
        line-height: 1.5;
      ">${esc(layer.tech)}</div>
    </div>
  `).join(`
    <div style="
      display: flex; align-items: center; justify-content: center;
      color: rgba(0,212,255,0.35); font-size: 1.2rem; flex-shrink: 0;
      padding: 0 4px;
    ">→</div>
  `);

  return `
<section id="how-it-works-section" style="padding: 0 24px 80px;">
  <div style="max-width: 1100px; margin: 0 auto;">

    <div class="reveal" style="margin-bottom: 32px;">
      <div class="font-mono text-xs uppercase tracking-widest" style="color: var(--accent-blue); margin-bottom: 8px; letter-spacing: 0.3em;">
        ◆ ARCHITECTURE
      </div>
      <h2 class="font-exo" style="font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0 0 8px;">
        How It Works
      </h2>
      <div style="height: 1px; background: linear-gradient(90deg, var(--accent-blue), transparent); width: 120px;"></div>
    </div>

    <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      align-items: stretch;
    ">
      ${cardsHtml}
    </div>

  </div>
</section>`;
}

function buildNarrativeArc() {
  return `
<section id="narrative-arc-section" style="padding: 0 0px 0px; min-height: 100vh; display: flex; flex-direction: column;">
  <div style="max-width: 1200px; margin: 0 auto; width: 100%; position: relative; z-index: 10; padding-left: 24px; padding-right: 24px;">
    <div class="reveal" style="margin-bottom: 32px; padding-top: 40px;">
      <div class="font-mono text-xs uppercase tracking-widest" style="color: var(--accent-violet); margin-bottom: 8px; letter-spacing: 0.3em;">
        ◆ CORE CONCEPT
      </div>
      <h2 class="font-exo" style="font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0 0 8px;">
        The Addiction Narrative Arc
      </h2>
      <div style="height: 1px; background: linear-gradient(90deg, var(--accent-violet), transparent); width: 200px;"></div>
      <p style="color: rgba(255,255,255,0.45); font-size: 0.85rem; margin-top: 12px; max-width: 640px; line-height: 1.7;">
        SIGNAL's core innovation: classifying <em>where in the addiction journey</em> a social media post falls. Click on a node in the orbital timeline to view stage characteristics.
      </p>
    </div>
  </div>

  <div id="orbital-timeline-wrapper" class="w-full flex-1 flex flex-col items-center justify-center relative overflow-visible" style="min-height: 800px; margin-top: -60px;">
    <div class="relative w-full max-w-5xl h-full flex items-center justify-center" style="min-height: 800px;">
        <!-- Center Orbit container -->
        <div id="orbit-ring" class="absolute flex items-center justify-center" style="width: 100%; height: 100%; perspective: 1000px; transform-style: preserve-3d; transition: transform 0.5s ease;">
            
            <div class="absolute w-20 h-20 rounded-full animate-pulse flex items-center justify-center z-10" style="background: linear-gradient(to bottom right, #7c3aed, #00d4ff, #10b981); box-shadow: 0 0 30px rgba(0,212,255,0.4);">
                <div class="absolute w-28 h-28 rounded-full border border-white/20 animate-ping opacity-70"></div>
                <div class="absolute w-36 h-36 rounded-full border border-white/10 animate-ping opacity-50" style="animation-delay: 0.5s;"></div>
                <div class="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-inner"></div>
            </div>

            <!-- Orbit ring border -->
            <div class="absolute rounded-full border border-white/10" style="width: 600px; height: 600px;"></div>
            
            <!-- Nodes will be injected here by JS -->
            <div id="nodes-container" class="absolute" style="left: 50%; top: 50%;"></div>
        </div>
    </div>
  </div>
</section>
  `;
}

function initOrbitalTimeline() {
    const wrapper = document.getElementById('orbital-timeline-wrapper');
    if (!wrapper) return;
    if (window._orbitalRAF) cancelAnimationFrame(window._orbitalRAF);
    
    const orbitRing = document.getElementById('orbit-ring');
    const nodesContainer = document.getElementById('nodes-container');
    if (!orbitRing || !nodesContainer) return;
    
    nodesContainer.innerHTML = '';
    
    let rotationAngle = 0;
    let autoRotate = true;
    let activeNodeId = null;
    let expandedItems = {};
    let pulseEffect = {};
    
    // Create elements ONCE
    const nodeEls = {};
    
    STAGES.forEach((item) => {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'absolute transition-all duration-700 cursor-pointer pointer-events-auto';
        
        nodeDiv.innerHTML = `
            <div class="node-halo absolute rounded-full -inset-1" style="background: radial-gradient(circle, ${item.color}40 0%, ${item.color}00 70%); border-radius: 50%;"></div>
            <div class="node-core w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 transform shadow-md absolute" style="left: -24px; top: -24px; background-color: ${item.color}15; border-color: ${item.color}80; color: ${item.color};">
                <i data-lucide="${item.icon}" style="width: 18px; height: 18px;"></i>
            </div>
            <div class="node-title absolute whitespace-nowrap text-xs font-bold tracking-wider transition-all duration-300" style="left: 0; top: 32px; transform: translateX(-50%); color: ${item.color}; text-shadow: 0 0 10px ${item.color}40;">
                ${item.name}
            </div>
            <div class="node-card absolute w-64 bg-black/90 backdrop-blur-lg border shadow-xl overflow-visible rounded-lg flex-col pointer-events-auto p-4 hidden" style="border-color: ${item.color}50; left: 0; top: 60px; transform: translateX(-50%); box-shadow: 0 10px 30px -10px ${item.color}80; cursor: default;">
                <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3" style="background-color: ${item.color};"></div>
                <div class="flex justify-between items-center mb-2">
                  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider" style="background: ${item.color}25; color: ${item.color}; border-color: ${item.color}50;">STAGE ${item.id}</span>
                </div>
                <h3 class="text-sm font-semibold mb-2 text-white">${item.name}</h3>
                <p class="text-xs text-white/70 mb-4 leading-relaxed">${item.description}</p>
                <div class="mb-4">
                  <ul class="text-[0.65rem] text-white/60 list-none space-y-1.5 p-0 m-0">
                    ${item.signals.map(s => `<li class="relative pl-3"><span class="absolute left-0 text-[${item.color}]">›</span> ${esc(s)}</li>`).join('')}
                  </ul>
                </div>
                <div class="pt-3 border-t border-white/10">
                  <div class="flex justify-between items-center text-[10px] uppercase mb-1.5 font-semibold text-white/50">
                    <span class="flex items-center">
                      <i data-lucide="activity" class="w-3 h-3 mr-1" style="color: ${item.color};"></i>
                      Risk Level
                    </span>
                    <span class="font-mono text-white/80">${item.energy}%</span>
                  </div>
                  <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full" style="width: ${item.energy}%; background: ${item.color}; box-shadow: 0 0 8px ${item.color}; border-radius: 9999px;"></div>
                  </div>
                </div>
                ${item.relatedIds.length > 0 ? `
                <div class="mt-4 pt-3 border-t border-white/10">
                  <div class="flex items-center mb-2">
                    <i data-lucide="link" class="w-3 h-3 text-white/40 mr-1"></i>
                    <h4 class="text-[9px] uppercase tracking-widest font-bold text-white/40 m-0">Connected Stages</h4>
                  </div>
                  <div class="flex flex-wrap gap-1 related-btns"></div>
                </div>` : ''}
            </div>
        `;
        
        if (item.relatedIds.length > 0) {
            const relContainer = nodeDiv.querySelector('.related-btns');
            item.relatedIds.forEach(relId => {
                const relItem = STAGES.find(i => i.id === relId);
                if (relItem) {
                    const btn = document.createElement('button');
                    btn.className = "flex items-center h-6 px-2 py-0 text-[10px] rounded border border-white/20 bg-black/50 hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer";
                    btn.innerHTML = `${relItem.name} &nbsp; <i data-lucide="arrow-right" class="w-2 h-2 opacity-50"></i>`;
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        toggleItem(relId);
                    };
                    relContainer.appendChild(btn);
                }
            });
        }

        nodeDiv.onclick = (e) => {
            if (e.target.closest('.node-card')) return; 
            e.stopPropagation();
            toggleItem(item.id);
        };
        
        nodesContainer.appendChild(nodeDiv);
        nodeEls[item.id] = {
            el: nodeDiv,
            halo: nodeDiv.querySelector('.node-halo'),
            core: nodeDiv.querySelector('.node-core'),
            title: nodeDiv.querySelector('.node-title'),
            card: nodeDiv.querySelector('.node-card'),
            data: item
        };
    });
    
    if (window.lucide) window.lucide.createIcons({ root: wrapper });
    
    let lastTime = 0;
    
    function updatePhysics(time) {
        if (!lastTime) lastTime = time;
        const delta = time - lastTime;
        lastTime = time;
        
        if (autoRotate) {
             rotationAngle = (rotationAngle + (0.05 * delta)) % 360;
        }

        const total = STAGES.length;

        STAGES.forEach((item, index) => {
            const node = nodeEls[item.id];
            const angle = ((index / total) * 360 + rotationAngle) % 360;
            // Radius matches half of the 600px outer ring
            const radius = 300; 
            const radian = (angle * Math.PI) / 180;
            
            const px = radius * Math.cos(radian);
            const py = radius * Math.sin(radian);
            
            const zIndex = Math.round(100 + 50 * Math.cos(radian));
            // Enhance opacity range so items in back aren't completely faded
            const opacity = Math.max(0.6, Math.min(1, 0.5 + 0.5 * ((1 + Math.sin(radian)) / 2)));
            
            const isExpanded = !!expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = !!pulseEffect[item.id];
            
            node.el.style.transform = `translate(${px}px, ${py}px)`;
            node.el.style.zIndex = isExpanded ? 200 : zIndex;
            node.el.style.opacity = isExpanded ? 1 : opacity;
            
            const sizeMap = item.energy * 0.4 + 50;
            node.halo.style.width = `${sizeMap}px`;
            node.halo.style.height = `${sizeMap}px`;
            node.halo.style.left = `-${sizeMap/2}px`;
            node.halo.style.top = `-${sizeMap/2}px`;
            
            if (isPulsing) {
                node.halo.classList.add('animate-pulse');
            } else {
                node.halo.classList.remove('animate-pulse');
            }
            
            if (isExpanded) {
                node.core.className = "node-core w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-black border-white shadow-[0_0_20px_rgba(255,255,255,0.6)] absolute";
                node.core.style.left = "-28px";
                node.core.style.top = "-28px";
                node.core.style.color = item.color;
                node.core.style.borderColor = "white";
                node.core.style.backgroundColor = 'black';
                
                node.title.className = "node-title absolute whitespace-nowrap text-sm font-bold tracking-wider transition-all duration-300";
                node.title.style.color = "white";
                node.title.style.top = "40px";
                node.title.style.transform = "translateX(-50%) scale(1.15)";
                node.title.style.textShadow = `0 0 10px rgba(255,255,255,0.5)`;
                
                node.card.style.display = "flex";
            } else if (isRelated) {
                node.core.className = "node-core w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 absolute animate-pulse";
                node.core.style.left = "-24px";
                node.core.style.top = "-24px";
                node.core.style.color = 'white';
                node.core.style.borderColor = 'white';
                node.core.style.backgroundColor = `${item.color}40`;
                node.core.style.boxShadow = `0 0 15px ${item.color}60`;
                
                node.title.className = "node-title absolute whitespace-nowrap text-xs font-bold tracking-wider transition-all duration-300 text-white";
                node.title.style.color = "white";
                node.title.style.top = "32px";
                node.title.style.transform = "translateX(-50%)";
                node.title.style.textShadow = `0 0 8px ${item.color}80`;
                
                node.card.style.display = "none";
            } else {
                node.core.className = "node-core w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 absolute transform hover:scale-110";
                node.core.style.left = "-24px";
                node.core.style.top = "-24px";
                node.core.style.color = item.color;
                node.core.style.borderColor = `${item.color}80`;
                node.core.style.backgroundColor = `${item.color}15`;
                node.core.style.boxShadow = "none";
                
                node.title.className = "node-title absolute whitespace-nowrap text-xs font-bold tracking-wider transition-all duration-300";
                node.title.style.color = item.color;
                node.title.style.top = "32px";
                node.title.style.transform = "translateX(-50%)";
                node.title.style.textShadow = `0 0 10px ${item.color}40`;
                
                node.card.style.display = "none";
            }
        });
        
        window._orbitalRAF = requestAnimationFrame(updatePhysics);
    }
    
    function getRelatedItems(itemId) {
        const item = STAGES.find(i => i.id === itemId);
        return item ? item.relatedIds : [];
    }
    
    function isRelatedToActive(itemId) {
        if (!activeNodeId) return false;
        return getRelatedItems(activeNodeId).includes(itemId);
    }
    
    function centerViewOnNode(nodeId) {
        const nodeIndex = STAGES.findIndex(item => item.id === nodeId);
        const totalNodes = STAGES.length;
        const targetAngle = (nodeIndex / totalNodes) * 360;
        rotationAngle = 270 - targetAngle;
    }
    
    function toggleItem(id) {
        const isCurrentExpanded = !!expandedItems[id];
        expandedItems = {};
        
        if (!isCurrentExpanded) {
            expandedItems[id] = true;
            activeNodeId = id;
            autoRotate = false;
            
            getRelatedItems(id).forEach(relId => {
                pulseEffect[relId] = true;
            });
            centerViewOnNode(id);
        } else {
            activeNodeId = null;
            autoRotate = true;
            pulseEffect = {};
        }
    }
    
    wrapper.onclick = (e) => {
        if (e.target === wrapper || e.target === orbitRing || e.target.id === 'nodes-container') {
            expandedItems = {};
            activeNodeId = null;
            pulseEffect = {};
            autoRotate = true;
        }
    };
    
    window._orbitalRAF = requestAnimationFrame(updatePhysics);

    // Teardown hook for page transitions
    window._orbitalCleanup = () => {
        cancelAnimationFrame(window._orbitalRAF);
        window._orbitalRAF = null;
        window._orbitalCleanup = null;
    };
}

export async function renderAboutPage(container) {
  // Add some top padding to account for the header
  container.innerHTML = `
    <div style="padding-top: calc(var(--nav-height, 60px) + 60px);">
      ${buildHowItWorks()}
      ${buildNarrativeArc()}
    </div>
  `;
  
  // Initialize the orbital timeline for the narrative arc
  initOrbitalTimeline();
}
