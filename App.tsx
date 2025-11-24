
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { D12Icon } from './components/D12Icon';
import History from './components/History';
import CharacterSheet from './components/CharacterSheet';
import AbilitiesTab from './components/AbilitiesTab';
import InventoryTab from './components/InventoryTab';
import { RollResult, RollOutcome, StandardDieType, RollMode, RollLogic, CharacterData } from './types';
import { Sword, RefreshCw, ShieldAlert, Sparkles, Dices, Hexagon, ChevronDown, ChevronUp, ChevronsUp, ChevronsDown, Sigma, NotebookPen, Type, Save, Bold, Italic, UserCircle, Book, Download, Upload, Backpack } from 'lucide-react';

// Helper to generate random number
const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;

const defaultCharacter: CharacterData = {
  name: '',
  ancestry1: '',
  ancestry2: '',
  class: '',
  subclass: '',
  level: 1,
  proficiency: 1,
  evasion: 0,
  hp: { current: 6, max: 6 },
  fatigue: { current: 6, max: 6 },
  hope: { current: 2, max: 6 }, // Updated to 6 based on user request
  armor: { value: 0, slots: { current: 0, max: 0 } },
  thresholds: { major: 0, severe: 0 },
  attributes: {
    agility: 0,
    strength: 0,
    finesse: 0,
    instinct: 0,
    presence: 0,
    knowledge: 0
  },
  experiences: [],
  abilities: [],
  inventory: []
};

const App: React.FC = () => {
  // App State
  const [mode, setMode] = useState<RollMode>('duality');
  const [history, setHistory] = useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [modifier, setModifier] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Character Sheet State
  const [character, setCharacter] = useState<CharacterData>(() => {
    const saved = localStorage.getItem('daggerheart_character');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default to ensure new fields exist
        return {
          ...defaultCharacter,
          ...parsed,
          // Migration logic for old 'ancestry' string field
          ancestry1: parsed.ancestry1 || parsed.ancestry || '',
          ancestry2: parsed.ancestry2 || '',
          
          subclass: parsed.subclass || '',
          level: parsed.level || 1,
          proficiency: parsed.proficiency || 1,
          evasion: parsed.evasion || 0,
          fatigue: parsed.fatigue || defaultCharacter.fatigue,
          hope: parsed.hope || defaultCharacter.hope,
          armor: parsed.armor || defaultCharacter.armor,
          thresholds: parsed.thresholds || defaultCharacter.thresholds,
          attributes: { ...defaultCharacter.attributes, ...(parsed.attributes || {}) },
          experiences: parsed.experiences || [],
          abilities: parsed.abilities || [],
          inventory: parsed.inventory || []
        };
      } catch (e) {
        console.error("Error loading character data", e);
        return defaultCharacter;
      }
    }
    return defaultCharacter;
  });

  // Notes State
  const [notes, setNotes] = useState<string>(() => localStorage.getItem('daggerheart_notes') || '');
  const notesRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number>(14);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);

  // Duality State
  const [hopeValue, setHopeValue] = useState<number>(1);
  const [fearValue, setFearValue] = useState<number>(1);
  const [lastDualityResult, setLastDualityResult] = useState<RollResult | null>(null);

  // Standard Dice State
  const [stdDieType, setStdDieType] = useState<StandardDieType>(20);
  const [stdDiceCount, setStdDiceCount] = useState<number>(1);
  const [stdRollLogic, setStdRollLogic] = useState<RollLogic>('sum');
  const [stdCurrentRolls, setStdCurrentRolls] = useState<number[]>([1]); 
  const [lastStdResult, setLastStdResult] = useState<RollResult | null>(null);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  // Initialize notes content
  useEffect(() => {
    if (notesRef.current && mode === 'notes') {
      if (notesRef.current.innerHTML !== notes) {
        notesRef.current.innerHTML = notes;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Auto-save notes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('daggerheart_notes', notes);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [notes]);

  // Auto-save Character Data
  useEffect(() => {
    localStorage.setItem('daggerheart_character', JSON.stringify(character));
  }, [character]);
  
  const handleNotesInput = (e: React.FormEvent<HTMLDivElement>) => {
    const content = e.currentTarget.innerHTML;
    setNotes(content);
    if (!showSaveIndicator) {
      setTimeout(() => {
        setShowSaveIndicator(true);
        setTimeout(() => setShowSaveIndicator(false), 2000);
      }, 1000);
    }
  };

  const handleFormat = (command: string) => {
    const selection = window.getSelection();
    const editor = notesRef.current;
    if (!editor || !selection) return;

    const isSelectionInEditor = editor.contains(selection.anchorNode);
    
    if (!isSelectionInEditor || selection.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand(command, false);
    setNotes(editor.innerHTML);
    editor.focus();
  };

  // --- EXPORT / IMPORT ---
  const handleExport = () => {
    const dataStr = JSON.stringify(character, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${character.name || 'personagem'}_daggerheart.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Validar minimamente
        if (typeof json === 'object') {
            const merged = {
              ...defaultCharacter,
              ...json,
              // Garantir migração no import também
              ancestry1: json.ancestry1 || json.ancestry || '',
              ancestry2: json.ancestry2 || '',
              evasion: json.evasion || 0,

              // Garantir que arrays e objetos aninhados existam
              hp: { ...defaultCharacter.hp, ...(json.hp || {}) },
              fatigue: { ...defaultCharacter.fatigue, ...(json.fatigue || {}) },
              hope: { ...defaultCharacter.hope, ...(json.hope || {}) },
              armor: { ...defaultCharacter.armor, ...(json.armor || {}) },
              thresholds: { ...defaultCharacter.thresholds, ...(json.thresholds || {}) },
              attributes: { ...defaultCharacter.attributes, ...(json.attributes || {}) },
              experiences: json.experiences || [],
              abilities: json.abilities || [],
              inventory: json.inventory || []
            };
            setCharacter(merged);
            alert('Ficha importada com sucesso!');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao importar arquivo. Certifique-se que é um JSON válido.');
      }
    };
    reader.readAsText(file);
    // Reset value so we can select same file again if needed
    e.target.value = '';
  };


  // --- DUALITY LOGIC ---
  const determineDualityOutcome = (hope: number, fear: number): RollOutcome => {
    if (hope === fear) return 'critical';
    return hope > fear ? 'hope' : 'fear';
  };

  const handleDualityRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    
    let counter = 0;
    const maxCount = 10; 
    const speed = 60; 
    
    intervalRef.current = window.setInterval(() => {
      setHopeValue(rollDie(12));
      setFearValue(rollDie(12));
      counter++;
      
      if (counter >= maxCount) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        finishDualityRoll();
      }
    }, speed);
  }, [isRolling, modifier]);

  const finishDualityRoll = () => {
    const finalHope = rollDie(12);
    const finalFear = rollDie(12);
    
    setHopeValue(finalHope);
    setFearValue(finalFear);
    
    const outcome = determineDualityOutcome(finalHope, finalFear);
    
    const newResult: RollResult = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      mode: 'duality',
      hopeValue: finalHope,
      fearValue: finalFear,
      modifier: modifier,
      total: finalHope + finalFear + modifier,
      outcome
    };

    setLastDualityResult(newResult);
    setHistory(prev => [newResult, ...prev].slice(0, 50));
    setIsRolling(false);
  };

  // --- STANDARD LOGIC ---
  const handleStandardRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);

    let counter = 0;
    const maxCount = 8;
    const speed = 70;

    const tempRolls = Array(stdDiceCount).fill(1);

    intervalRef.current = window.setInterval(() => {
      const randoms = tempRolls.map(() => rollDie(stdDieType));
      setStdCurrentRolls(randoms);
      counter++;

      if (counter >= maxCount) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        finishStandardRoll();
      }
    }, speed);

  }, [isRolling, modifier, stdDiceCount, stdDieType, stdRollLogic]);

  const finishStandardRoll = () => {
    const finalRolls = Array(stdDiceCount).fill(0).map(() => rollDie(stdDieType));
    setStdCurrentRolls(finalRolls);
    
    let calculationTotal = 0;

    if (stdRollLogic === 'sum') {
      calculationTotal = finalRolls.reduce((a, b) => a + b, 0);
    } else if (stdRollLogic === 'keepHighest') {
      calculationTotal = Math.max(...finalRolls);
    } else if (stdRollLogic === 'keepLowest') {
      calculationTotal = Math.min(...finalRolls);
    }

    const newResult: RollResult = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      mode: 'standard',
      diceCount: stdDiceCount,
      dieType: stdDieType,
      rolls: finalRolls,
      modifier: modifier,
      total: calculationTotal + modifier,
      outcome: 'standard',
      rollLogic: stdRollLogic
    };

    setLastStdResult(newResult);
    setHistory(prev => [newResult, ...prev].slice(0, 50));
    setIsRolling(false);
  };

  const clearHistory = () => setHistory([]);

  const getOutcomeConfig = (outcome: RollOutcome | undefined) => {
    switch (outcome) {
      case 'hope':
        return {
          title: "Esperança",
          desc: "Recupere uma Esperança.",
          colorClass: "text-hope-DEFAULT",
          bgClass: "bg-hope-dark/20 border-hope-DEFAULT/50",
          icon: <Sparkles className="w-5 h-5 text-hope-light" />
        };
      case 'fear':
        return {
          title: "Medo",
          desc: "O Mestre ganha um Medo.",
          colorClass: "text-fear-DEFAULT",
          bgClass: "bg-fear-dark/20 border-fear-DEFAULT/50",
          icon: <ShieldAlert className="w-5 h-5 text-fear-light" />
        };
      case 'critical':
        return {
          title: "Crítico",
          desc: "Sucesso Máximo.",
          colorClass: "text-crit-DEFAULT",
          bgClass: "bg-crit-DEFAULT/20 border-crit-DEFAULT/50",
          icon: <Sword className="w-5 h-5 text-crit-light" />
        };
      default:
        return null;
    }
  };

  const dualityConfig = lastDualityResult ? getOutcomeConfig(lastDualityResult.outcome) : null;

  return (
    <div className="h-screen w-full bg-[#0f172a] text-white font-sans flex flex-col items-center bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] overflow-hidden">
      
      {/* Header */}
      <header className="text-center pt-2 pb-2 flex-shrink-0 w-full max-w-2xl px-2 md:px-4 relative">
        <div className="flex items-center justify-center relative mb-2">
            <h1 className="text-xl md:text-2xl font-serif font-bold bg-gradient-to-r from-hope-light via-white to-fear-light bg-clip-text text-transparent drop-shadow-sm">
              Dualidade
            </h1>
            {/* Export/Import Controls - Absolute positioned on right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".json"
                />
                <button 
                  onClick={handleImportClick}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700"
                  title="Importar Ficha"
                >
                   <Upload size={14} />
                </button>
                <button 
                  onClick={handleExport}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700"
                  title="Salvar Ficha (Exportar)"
                >
                   <Download size={14} />
                </button>
            </div>
        </div>

        {/* Navigation Tabs */}
        {/* Changed flex-1 to shrink-0 to prevent overlap on small screens */}
        <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700 backdrop-blur-md shadow-lg overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => setMode('sheet')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap ${
              mode === 'sheet' 
              ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-inner border border-white/10' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
             <UserCircle size={14} />
             Ficha
          </button>
          <button
            onClick={() => setMode('abilities')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap ${
              mode === 'abilities' 
              ? 'bg-gradient-to-r from-indigo-900/60 to-indigo-800/60 text-white shadow-inner border border-white/10' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
             <Book size={14} />
             <span className="md:hidden">Hab.</span>
             <span className="hidden md:inline">Habilidades</span>
          </button>
          <button
            onClick={() => setMode('duality')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
              mode === 'duality' 
              ? 'bg-gradient-to-r from-cyan-900/50 to-fuchsia-900/50 text-white shadow-inner border border-white/10' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Dualidade
          </button>
          <button
            onClick={() => setMode('standard')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
              mode === 'standard' 
              ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-inner border border-white/10' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Padrão
          </button>
          <button
            onClick={() => setMode('inventory')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap ${
              mode === 'inventory' 
              ? 'bg-gradient-to-r from-emerald-900/60 to-emerald-800/60 text-white shadow-inner border border-white/10' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
             <Backpack size={14} />
             <span className="md:hidden">Inv.</span>
             <span className="hidden md:inline">Inventário</span>
          </button>
           <button
            onClick={() => setMode('notes')}
            className={`shrink-0 min-w-[70px] py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap ${
              mode === 'notes' 
              ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/40 text-amber-100 shadow-inner border border-amber-500/20' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <NotebookPen size={14} />
            <span className="hidden sm:inline">Notas</span>
            <span className="sm:hidden">Notas</span>
          </button>
        </div>
      </header>

      {/* Content Wrapper */}
      <div className="flex-1 w-full max-w-2xl flex flex-col items-center min-h-0 px-2 md:px-4 pb-2 relative">
        
        {mode === 'sheet' && (
          <CharacterSheet data={character} onChange={setCharacter} />
        )}

        {mode === 'abilities' && (
          <AbilitiesTab data={character} onChange={setCharacter} />
        )}
        
        {mode === 'inventory' && (
          <InventoryTab data={character} onChange={setCharacter} />
        )}

        {mode === 'notes' && (
          <div className="w-full flex-1 min-h-0 flex flex-col gap-2 animate-[fadeIn_0.2s_ease-out]">
             {/* Notes Controls */}
             <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-700/50 shrink-0">
                <div className="flex items-center gap-3">
                   {/* Font Size */}
                   <div className="flex items-center gap-1 bg-slate-800 rounded p-1">
                      <button onClick={() => setFontSize(Math.max(10, fontSize - 2))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ChevronDown size={14} /></button>
                      <span className="text-xs font-mono w-6 text-center text-slate-300">{fontSize}</span>
                      <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ChevronUp size={14} /></button>
                   </div>
                   
                   <div className="w-px h-4 bg-slate-700 mx-1"></div>

                   {/* Formatting Buttons */}
                   <div className="flex items-center gap-1">
                      <button 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => handleFormat('bold')} 
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Negrito"
                      >
                        <Bold size={14} />
                      </button>
                      <button 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => handleFormat('italic')} 
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Itálico"
                      >
                        <Italic size={14} />
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-2">
                   {showSaveIndicator && <span className="text-[10px] text-emerald-400 flex items-center gap-1 animate-pulse"><Save size={10}/> Salvo</span>}
                </div>
             </div>

             <div className="flex-1 w-full relative min-h-0">
                <div
                  ref={notesRef}
                  contentEditable
                  onInput={handleNotesInput}
                  style={{ fontSize: `${fontSize}px` }}
                  className="w-full h-full bg-slate-800/40 text-slate-200 rounded-xl border border-slate-700/50 p-4 overflow-y-auto focus:outline-none focus:border-amber-500/30 focus:bg-slate-800/60 transition-all scrollbar-thin scrollbar-thumb-slate-600 font-sans leading-relaxed break-words empty:before:content-['Escreva_suas_notas_aqui...'] empty:before:text-slate-600 empty:before:italic [&_b]:text-amber-300 [&_b]:font-bold [&_strong]:text-amber-300 [&_strong]:font-bold"
                />
             </div>
          </div>
        )}

        {(mode === 'duality' || mode === 'standard') && (
          <>
            <div className="w-full flex flex-col items-center justify-center shrink-0 py-2 gap-2">
              
              {mode === 'duality' && (
                <>
                  <div className="flex justify-center items-center gap-6 md:gap-12 py-2">
                    <div className="flex flex-col items-center gap-1 group">
                      <div className={`w-20 h-20 md:w-24 md:h-24 transition-transform duration-150 ${isRolling ? 'animate-shake' : ''} ${lastDualityResult?.outcome === 'hope' ? 'animate-pulse-glow-hope' : ''}`}>
                        <D12Icon value={hopeValue} type="hope" />
                      </div>
                      <span className="font-serif text-hope-light tracking-widest text-[10px] font-bold uppercase drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">Esperança</span>
                    </div>

                    <div className="text-slate-600 font-serif text-lg opacity-50">✕</div>

                    <div className="flex flex-col items-center gap-1 group">
                      <div className={`w-20 h-20 md:w-24 md:h-24 transition-transform duration-150 ${isRolling ? 'animate-shake' : ''} ${lastDualityResult?.outcome === 'fear' ? 'animate-pulse-glow-fear' : ''}`}>
                        <D12Icon value={fearValue} type="fear" />
                      </div>
                      <span className="font-serif text-fear-light tracking-widest text-[10px] font-bold uppercase drop-shadow-[0_0_5px_rgba(192,38,211,0.8)]">Medo</span>
                    </div>
                  </div>

                  <div className="h-[80px] w-full flex items-center justify-center">
                    {lastDualityResult && dualityConfig ? (
                      <div className={`w-full max-w-sm animate-[fadeIn_0.3s_ease-out] rounded-xl border px-4 py-2 text-center shadow-lg backdrop-blur-md transition-all ${dualityConfig.bgClass}`}>
                        <div className="flex items-center justify-center gap-2">
                          {dualityConfig.icon}
                          <h2 className={`text-lg font-bold font-serif uppercase ${dualityConfig.colorClass}`}>
                            {dualityConfig.title}
                          </h2>
                        </div>
                        
                        <div className="flex justify-center items-baseline gap-2">
                          <span className="text-[10px] text-slate-400 uppercase">Total:</span>
                          <span className="text-2xl font-bold text-white drop-shadow-lg">
                            {lastDualityResult.total}
                          </span>
                          {modifier !== 0 && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({lastDualityResult.hopeValue} + {lastDualityResult.fearValue} + {modifier})
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic opacity-50">
                        Role os dados para ver o resultado
                      </div>
                    )}
                  </div>
                </>
              )}

              {mode === 'standard' && (
                <div className="w-full max-w-sm flex flex-col gap-3">
                  <div className="grid grid-cols-6 gap-1 p-1 bg-slate-900/40 rounded-xl border border-slate-800">
                    {[4, 6, 8, 10, 12, 20].map((d) => (
                      <button
                        key={d}
                        onClick={() => setStdDieType(d as StandardDieType)}
                        className={`flex flex-col items-center justify-center h-8 rounded transition-all ${
                          stdDieType === d 
                          ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]' 
                          : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-[10px] font-bold">d{d}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 bg-slate-900/30 rounded-xl p-2 border border-slate-800">
                    <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => setStdDiceCount(Math.max(1, stdDiceCount - 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        ><ChevronDown size={16} /></button>
                        <div className="flex flex-col items-center w-16">
                          <span className="text-2xl font-bold font-serif text-white leading-none">{stdDiceCount}</span>
                          <span className="text-[9px] uppercase text-slate-500 tracking-widest">Dados</span>
                        </div>
                        <button 
                          onClick={() => setStdDiceCount(Math.min(20, stdDiceCount + 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        ><ChevronUp size={16} /></button>
                    </div>

                    <div className="flex items-center justify-center gap-1 p-1 bg-slate-950/50 rounded-lg">
                        <button
                          onClick={() => setStdRollLogic('sum')}
                          className={`flex-1 py-1 flex items-center justify-center gap-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${
                              stdRollLogic === 'sum' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Somar Todos"
                        >
                          <Sigma size={12} />
                          Soma
                        </button>
                        <button
                          onClick={() => setStdRollLogic('keepHighest')}
                          className={`flex-1 py-1 flex items-center justify-center gap-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${
                              stdRollLogic === 'keepHighest' ? 'bg-emerald-900/60 text-emerald-300 shadow-sm border border-emerald-800/50' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Pegar Maior Resultado"
                        >
                          <ChevronsUp size={12} />
                          Maior
                        </button>
                        <button
                          onClick={() => setStdRollLogic('keepLowest')}
                          className={`flex-1 py-1 flex items-center justify-center gap-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${
                              stdRollLogic === 'keepLowest' ? 'bg-rose-900/60 text-rose-300 shadow-sm border border-rose-800/50' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Pegar Menor Resultado"
                        >
                          <ChevronsDown size={12} />
                          Menor
                        </button>
                    </div>
                  </div>

                  <div className="min-h-[120px] flex flex-col items-center justify-center p-4 bg-slate-900/60 rounded-xl border border-slate-700/50 relative overflow-hidden transition-all">
                      {isRolling ? (
                        <div className="flex flex-wrap justify-center gap-2 animate-pulse opacity-80">
                            {stdCurrentRolls.slice(0, 12).map((val, idx) => (
                                <div key={idx} className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-600 font-bold font-serif text-sm text-white shadow-md">
                                    {val}
                                </div>
                            ))}
                        </div>
                      ) : lastStdResult ? (
                        <div className="flex flex-col items-center animate-[fadeIn_0.3s_ease-out] w-full">
                            <div className="flex flex-col items-center justify-center mb-2 relative z-10">
                                <span className="text-[9px] text-indigo-300/70 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
                                  Resultado Total
                                  {lastStdResult.rollLogic === 'keepHighest' && <ChevronsUp size={10} className="text-emerald-400" />}
                                  {lastStdResult.rollLogic === 'keepLowest' && <ChevronsDown size={10} className="text-rose-400" />}
                                </span>
                                <span className="text-5xl font-serif font-bold text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.6)]">
                                    {lastStdResult.total}
                                </span>
                            </div>
                            
                            <div className="w-full flex flex-col items-center border-t border-slate-700/40 pt-2 mt-1">
                                <div className="flex flex-wrap justify-center gap-1.5 max-h-[40px] overflow-y-auto scrollbar-thin hover:opacity-100 transition-opacity">
                                    {lastStdResult.rolls?.map((val, idx) => {
                                        let isUsed = true;
                                        if (lastStdResult.rollLogic === 'keepHighest') {
                                          const rawTotal = lastStdResult.total - lastStdResult.modifier;
                                          isUsed = val === rawTotal; 
                                        } else if (lastStdResult.rollLogic === 'keepLowest') {
                                          const rawTotal = lastStdResult.total - lastStdResult.modifier;
                                          isUsed = val === rawTotal;
                                        }

                                        return (
                                          <span 
                                            key={idx} 
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                                                isUsed 
                                                  ? 'bg-indigo-900/50 text-indigo-200 border-indigo-700/50 font-bold' 
                                                  : 'bg-slate-800/30 text-slate-600 border-slate-800/50 decoration-slate-600 line-through opacity-60'
                                            }`} 
                                          >
                                              {val}
                                          </span>
                                        );
                                    })}
                                </div>
                                {modifier !== 0 && (
                                    <span className="text-[9px] text-slate-500 font-mono mt-1">
                                      ({lastStdResult.total - modifier}) + (Mod: {modifier})
                                    </span>
                                )}
                            </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-600 opacity-40">
                          <Hexagon className="w-8 h-8 mb-1 stroke-1" />
                          <span className="text-xs italic">Role os dados</span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 w-full max-w-sm flex items-center gap-2 justify-center bg-slate-900/40 p-2 rounded-xl border border-slate-800 mb-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 rounded-lg border border-slate-700 h-10">
                <label htmlFor="mod" className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Mod</label>
                <input 
                  id="mod"
                  type="number" 
                  value={modifier} 
                  onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                  className="w-10 bg-transparent text-center font-bold text-lg focus:outline-none text-white border-b border-slate-600 focus:border-white transition-colors p-0"
                />
              </div>

              <button
                onClick={mode === 'duality' ? handleDualityRoll : handleStandardRoll}
                disabled={isRolling}
                className={`
                  flex-1 h-10 group relative overflow-hidden rounded-lg px-4 font-serif font-bold text-md tracking-wider uppercase transition-all duration-200
                  ${isRolling 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : mode === 'duality'
                      ? 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  }
                `}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isRolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : (mode === 'duality' ? <Sword className="w-4 h-4 fill-current" /> : <Dices className="w-4 h-4" />)}
                  {isRolling ? 'Rolando...' : 'Rolar'}
                </span>
              </button>
            </div>

            <div className="flex-1 w-full flex flex-col min-h-0 items-center justify-start overflow-hidden">
                <History history={history} onClear={clearHistory} />
            </div>
          </>
        )}
        
        <footer className="shrink-0 mt-2 text-center text-slate-700 text-[9px] pb-1">
          Daggerheart - Fan Project
        </footer>

      </div>
    </div>
  );
};

export default App;
