import React, { useState, useEffect, useRef } from 'react';

// --- CÁC HẰNG SỐ CỐ ĐỊNH ---
const SCORE_LEVELS = [
  { label: 'Pass', color: 'text-green-400', desc: 'Kiến thức cốt lõi cơ bản' },
  { label: 'C', color: 'text-green-500', desc: 'Nắm vững định nghĩa' },
  { label: 'C+', color: 'text-green-500', desc: 'Hiểu và áp dụng nhẹ' },
  { label: 'B', color: 'text-green-600', desc: 'Áp dụng vào tình huống' },
  { label: 'B+', color: 'text-green-600', desc: 'Phân tích vấn đề' },
  { label: 'A', color: 'text-green-700', desc: 'Đánh giá & Vận dụng cao' },
  { label: 'A+', color: 'text-green-800', desc: 'Chuyên gia xử lý tình huống phức tạp' }
];

export default function EdTechRoadmapApp() {
  // --- STATE MANAGEMENT ---
  const [screen, setScreen] = useState(0); 
  const [appData, setAppData] = useState(null);
  const [globalQuestionBank, setGlobalQuestionBank] = useState([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);
  const [dailyQuestions, setDailyQuestions] = useState([]);
  
  const [activeDayQuiz, setActiveDayQuiz] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [dayResults, setDayResults] = useState([]);

  const rightColumnRef = useRef(null);
  const explanationRef = useRef(null);

  // --- CUSTOM ALERT MODAL STATE ---
  const [modal, setModal] = useState({
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null, onCancel: null
  });

  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    setModal({ isOpen: true, type, title, message, onConfirm, onCancel });
  };
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // --- FETCH API & LOCAL STORAGE (ĐÃ SỬA AUTO-LOAD) ---
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoadingAPI(true);
        const apiUrl = import.meta.env.VITE_API_URL;
        
        if (!apiUrl) throw new Error("Chưa cấu hình VITE_API_URL trong file .env");

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
        
        const apiData = await response.json();
        setGlobalQuestionBank(apiData);

        const savedData = localStorage.getItem('edTechData');
        if (savedData) {
          // AUTO-LOAD SILENTLY: Tự động nạp dữ liệu và vào thẳng Dashboard không cần hỏi
          const parsedData = JSON.parse(savedData);
          parsedData.questionBank = apiData; 
          if(!parsedData.progress.masteredIds) parsedData.progress.masteredIds = [];
          if(!parsedData.progress.reviewIds) parsedData.progress.reviewIds = [];
          
          setAppData(parsedData); 
          setScreen(3); // Chuyển thẳng vào màn hình Dashboard
          setIsLoadingAPI(false);
          return; 
        }
        
        // Nếu không có dữ liệu cũ thì mới vào màn hình 1
        setScreen(1); 
        setIsLoadingAPI(false);
      } catch (error) {
        console.error("❌ Lỗi API:", error);
        setScreen(1); 
        setIsLoadingAPI(false);
        showModal('alert', 'Lỗi kết nối', `Không thể tải dữ liệu: ${error.message}`);
      }
    };
    initializeApp();
  }, []);

  // --- AUTO-SAVE MỌI THAY ĐỔI VÀO LOCAL STORAGE ---
  useEffect(() => {
    if (appData) localStorage.setItem('edTechData', JSON.stringify(appData));
  }, [appData]);

  // --- NHẮC NHỞ HỌC TẬP (MỖI 1 GIỜ) ---
  useEffect(() => {
    if (screen < 3 || modal.isOpen) return;
    const ONE_HOUR_MS = 60 * 60 * 1000; 
    const saveReminderInterval = setInterval(() => {
      showModal(
        'alert', 
        '⏰ Nhắc nhở nghỉ ngơi', 
        'Bạn đã học tập liên tục 1 giờ rồi đấy! Hãy đứng lên vươn vai một chút nhé. Hệ thống đã tự động lưu lại toàn bộ tiến trình của bạn.'
      );
    }, ONE_HOUR_MS);
    return () => clearInterval(saveReminderInterval);
  }, [screen, modal.isOpen]);


  // --- XỬ LÝ SCROLL TRƯỢT MƯỢT MÀ ---
  useEffect(() => {
    if (rightColumnRef.current) rightColumnRef.current.scrollTop = 0;
  }, [currentQIndex]);

  useEffect(() => {
    if (selectedAnswer !== null && explanationRef.current) {
      setTimeout(() => {
        explanationRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [selectedAnswer]);

  // --- KEYBOARD SHORTCUTS HOOK ---
  useEffect(() => {
    if (screen !== 4 || isQuizFinished || modal.isOpen) return;

    const handleKeyDown = (e) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optionIndex = parseInt(e.key) - 1;
        if (selectedAnswer === null && dailyQuestions[currentQIndex]?.options[optionIndex]) {
          handleAnswer(optionIndex);
        }
      }
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (selectedAnswer !== null) nextQuestion();
      }
      if (e.key === 'Escape') handleExitQuiz();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, isQuizFinished, selectedAnswer, currentQIndex, dailyQuestions, modal.isOpen]);

  // --- MODAL KEYBOARD (Enter/Esc) ---
  useEffect(() => {
    if (!modal.isOpen) return;
    const handleModalKeys = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        modal.onCancel ? modal.onCancel() : closeModal();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        modal.onConfirm ? modal.onConfirm() : closeModal();
      }
    };
    window.addEventListener('keydown', handleModalKeys);
    return () => window.removeEventListener('keydown', handleModalKeys);
  }, [modal]);


  // --- ACTIONS ---
  const handleDateSubmit = (e) => {
    e.preventDefault();
    const dateInput = e.target.examDate.value;
    const daysLeft = Math.max(1, Math.ceil((new Date(dateInput) - new Date()) / (1000 * 60 * 60 * 24)));
    setAppData({
      examDate: dateInput, totalDays: daysLeft, targetScore: 0, questionBank: globalQuestionBank,
      progress: { currentDay: 1, completedDays: [], skippedDays: [], scores: {}, masteredIds: [], reviewIds: [] }
    });
    setScreen(2);
  };

  const startQuiz = (dayIndex) => {
    const targetDifficulty = SCORE_LEVELS[appData.targetScore].label;
    const targetIndex = SCORE_LEVELS.findIndex(s => s.label === targetDifficulty);
    const allowedDiffs = SCORE_LEVELS.slice(0, targetIndex + 1).map(s => s.label);
    
    let pool = appData.questionBank.filter(q => allowedDiffs.includes(q.difficultyLevel));
    if (pool.length === 0) pool = appData.questionBank;

    const baseQuota = Math.ceil(pool.length / appData.totalDays);
    const dailyTarget = Math.max(5, baseQuota); 

    const { masteredIds = [], reviewIds = [] } = appData.progress;
    const shuffle = (arr) => [...arr].sort(() => 0.5 - Math.random());
    
    let reviewPool = shuffle(pool.filter(q => reviewIds.includes(q.id)));
    let unseenPool = shuffle(pool.filter(q => !masteredIds.includes(q.id) && !reviewIds.includes(q.id)));
    let masteredPool = shuffle(pool.filter(q => masteredIds.includes(q.id)));

    let questionsForToday = [];
    const maxReviewCount = Math.ceil(dailyTarget * 0.5);
    const reviewCount = Math.min(maxReviewCount, reviewPool.length);
    questionsForToday.push(...reviewPool.slice(0, reviewCount));
    
    const remainingForTarget = dailyTarget - questionsForToday.length;
    const unseenCount = Math.min(remainingForTarget, unseenPool.length);
    questionsForToday.push(...unseenPool.slice(0, unseenCount));

    if (questionsForToday.length < dailyTarget) {
      questionsForToday.push(...masteredPool.slice(0, dailyTarget - questionsForToday.length));
    }

    questionsForToday = shuffle(questionsForToday);
    if (questionsForToday.length === 0) return showModal('alert', 'Cảnh báo', 'Không có câu hỏi.');

    setDailyQuestions(questionsForToday); setActiveDayQuiz(dayIndex); setCurrentQIndex(0);
    setQuizScore(0); setSelectedAnswer(null); setIsQuizFinished(false); setDayResults([]); 
    setScreen(4);
  };

  const handleDaySelect = (dayIndex) => {
    const { progress } = appData;
    const isLocked = dayIndex > progress.currentDay && !progress.completedDays.includes(dayIndex - 1);
    
    if (isLocked) {
      showModal('confirm', 'Cảnh báo học vượt', 'Bạn chưa hoàn thành các ngày học trước. Bạn vẫn muốn học vượt ngày này?', 
        () => {
          setAppData(prev => ({ ...prev, progress: { ...prev.progress, skippedDays: [...new Set([...prev.progress.skippedDays, dayIndex])] }}));
          startQuiz(dayIndex);
          closeModal();
        },
        closeModal
      );
      return;
    }
    startQuiz(dayIndex);
  };

  const handleAnswer = (optionIdx) => {
    if (selectedAnswer !== null) return; 
    setSelectedAnswer(optionIdx);
    const currentQ = dailyQuestions[currentQIndex];
    const isCorrect = optionIdx === currentQ.correctAnswer;
    setDayResults(prev => [...prev, { id: currentQ.id, isCorrect }]);
    if (isCorrect) setQuizScore(prev => prev + 1);
  };

  const nextQuestion = () => {
      if (currentQIndex < dailyQuestions.length - 1) {
        setCurrentQIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        setIsQuizFinished(true);
      }
  };

  const handleExitQuiz = () => {
    showModal('confirm', 'Tạm dừng bài học', 'Bạn muốn thoát ra ngoài? Tiến trình các câu đã làm của ngày hôm nay sẽ không được lưu lại.', 
      () => { setScreen(3); closeModal(); }, closeModal
    );
  }

  // Nút Xóa dữ liệu cũ sẽ được đặt ở màn hình Dashboard
  const resetProgress = () => {
    showModal('confirm', 'Làm mới lộ trình', 'Xóa TOÀN BỘ tiến độ học tập và tạo lộ trình mới? Hành động này không thể hoàn tác.', 
      () => { localStorage.removeItem('edTechData'); window.location.reload(); }, closeModal
    );
  }

  const finishQuiz = () => {
    setAppData(prev => {
      let newMasteredIds = [...(prev.progress.masteredIds || [])];
      let newReviewIds = [...(prev.progress.reviewIds || [])];

      dayResults.forEach(res => {
        if (res.isCorrect) {
          if (!newMasteredIds.includes(res.id)) newMasteredIds.push(res.id);
          newReviewIds = newReviewIds.filter(id => id !== res.id); 
        } else {
          if (!newReviewIds.includes(res.id)) newReviewIds.push(res.id);
          newMasteredIds = newMasteredIds.filter(id => id !== res.id); 
        }
      });

      const newCompleted = [...new Set([...prev.progress.completedDays, activeDayQuiz])];
      const newSkipped = prev.progress.skippedDays.filter(d => d !== activeDayQuiz);
      const nextDay = activeDayQuiz >= prev.progress.currentDay ? activeDayQuiz + 1 : prev.progress.currentDay;
      
      return {
        ...prev,
        progress: {
          ...prev.progress, completedDays: newCompleted, skippedDays: newSkipped,
          currentDay: nextDay, scores: { ...prev.progress.scores, [activeDayQuiz]: quizScore },
          masteredIds: newMasteredIds, reviewIds: newReviewIds
        }
      };
    });
    setScreen(3);
  };

  // --- RENDERERS ---
  if (isLoadingAPI) return (
    <div className="fixed inset-0 bg-white flex justify-center items-center">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Đang đồng bộ dữ liệu...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white flex flex-col font-sans text-slate-800 overflow-hidden">
      
      {/* --- CUSTOM MODAL --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-8">
              <h3 className={`text-xl font-bold mb-3 ${modal.type === 'confirm' ? 'text-slate-800' : 'text-red-600'}`}>
                {modal.title}
              </h3>
              <p className="text-slate-600 leading-relaxed mb-8">{modal.message}</p>
              <div className="flex gap-3 justify-end">
                {modal.type === 'confirm' && (
                  <button onClick={modal.onCancel || closeModal} className="px-5 py-3 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                    Hủy (Esc)
                  </button>
                )}
                <button onClick={modal.onConfirm || closeModal} className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-md shadow-green-200 transition-all active:scale-95">
                  Đồng ý (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SCREEN 1, 2, 3 === */}
      {screen < 4 && (
        <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col relative h-full">
          {screen === 1 && (
            <div className="flex-1 flex flex-col p-8 justify-center animate-fade-in">
              <div className="text-6xl mb-6 text-center animate-bounce">🗓️</div>
              <h1 className="text-4xl font-bold text-center mb-3">Mục tiêu thời gian</h1>
              <p className="text-slate-500 mb-10 text-center text-lg">Hệ thống có <b className="text-green-600">{globalQuestionBank.length} câu</b>.</p>
              <form onSubmit={handleDateSubmit} className="space-y-6 max-w-md mx-auto w-full">
                <input type="date" name="examDate" required min={new Date().toISOString().split("T")[0]} className="w-full p-5 border-2 border-slate-200 rounded-xl text-lg focus:border-green-500 outline-none" />
                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-5 rounded-xl shadow-lg text-lg transition-transform active:scale-95">Bắt đầu thiết lập</button>
              </form>
            </div>
          )}

          {screen === 2 && (
            <div className="flex-1 flex flex-col p-8 justify-center text-center animate-fade-in">
              <h1 className="text-4xl font-bold mb-3">Đích đến của bạn</h1>
              <p className="text-slate-500 mb-12 text-lg">Hãy chọn mức điểm mục tiêu.</p>
              <div className="space-y-8 max-w-md mx-auto w-full">
                <div className="text-center h-40 flex flex-col justify-center bg-slate-50 rounded-3xl border border-slate-100">
                  <span className={`text-8xl font-black ${SCORE_LEVELS[appData.targetScore].color} transition-colors`}>{SCORE_LEVELS[appData.targetScore].label}</span>
                  <p className="mt-4 text-slate-500 font-medium text-lg">{SCORE_LEVELS[appData.targetScore].desc}</p>
                </div>
                <input type="range" min="0" max="6" value={appData.targetScore} onChange={(e) => setAppData({...appData, targetScore: parseInt(e.target.value)})} className="w-full h-4 bg-slate-200 rounded-lg accent-green-600 cursor-pointer" />
                <button onClick={() => setScreen(3)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-5 rounded-xl mt-8 text-lg transition-transform active:scale-95">Tạo lộ trình cá nhân hóa</button>
              </div>
            </div>
          )}

          {screen === 3 && (
            <div className="flex-1 flex flex-col overflow-hidden py-8">
              <div className="p-6 bg-white shrink-0">
                <h2 className="text-3xl font-black mb-6 text-center">Lộ trình {appData.totalDays} ngày</h2>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-4"><div className="bg-green-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${(appData.progress.completedDays.length / appData.totalDays) * 100}%` }}></div></div>
                <div className="flex justify-between items-center px-2">
                    <p className="text-sm font-semibold text-slate-500">Hoàn thành: {Math.round((appData.progress.completedDays.length / appData.totalDays) * 100)}%</p>
                    <button onClick={resetProgress} className="text-sm font-semibold text-red-500 hover:text-red-700 underline">Làm mới lộ trình (Xóa tiến trình)</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
                {Array.from({ length: appData.totalDays }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isCompleted = appData.progress.completedDays.includes(dayNum);
                  const isCurrent = appData.progress.currentDay === dayNum;
                  const isLocked = dayNum > appData.progress.currentDay && !isCompleted;

                  return (
                    <div key={dayNum} onClick={() => handleDaySelect(dayNum)} className={`p-5 rounded-2xl border-2 flex items-center gap-5 cursor-pointer transition-all ${isCompleted ? "bg-green-50 border-green-200" : isCurrent ? "bg-white border-green-500 shadow-md transform hover:-translate-y-1" : "bg-slate-50 border-slate-100 opacity-60 hover:opacity-100"}`}>
                      <div className="text-4xl">{isCompleted ? "✅" : isCurrent ? "🔥" : "🔒"}</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-xl mb-1">Ngày {dayNum}</h4>
                        <p className="text-sm text-slate-500">{isCompleted ? `Hoàn thành: ${appData.progress.scores[dayNum]} điểm` : isCurrent ? 'Sẵn sàng ôn luyện' : 'Chưa mở khóa'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== SCREEN 4: QUIZ (LAYOUT CHUẨN UX MỚI) ===================== */}
      {screen === 4 && dailyQuestions.length > 0 && (
        <div className="flex-1 flex flex-col w-full h-full animate-fade-in relative bg-slate-50">
          {!isQuizFinished ? (
            <>
              {/* --- HEADER CỐ ĐỊNH --- */}
              <div className="h-16 bg-white border-b border-slate-200 shrink-0 shadow-sm z-20 flex items-center justify-between px-6 md:px-10">
                <div className="flex items-center gap-6 flex-1">
                  <div className="font-bold text-slate-700 whitespace-nowrap">Ngày {activeDayQuiz}</div>
                  <div className="flex-1 max-w-xl flex items-center gap-4">
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${((currentQIndex) / dailyQuestions.length) * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-green-600 whitespace-nowrap">{currentQIndex + 1}/{dailyQuestions.length}</span>
                  </div>
                </div>
                <button onClick={handleExitQuiz} className="ml-6 p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 font-bold flex items-center gap-2 transition-colors">
                  <span className="hidden md:inline">Thoát</span> ✕
                </button>
              </div>

              {/* --- PHẦN NỘI DUNG CHIA 2 CỘT (FLEX-1) --- */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                
                {/* CỘT TRÁI: CÂU HỎI */}
                <div className="w-full md:w-1/2 h-full overflow-y-auto bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col custom-scrollbar">
                  <div className="p-8 md:p-16 max-w-3xl mx-auto w-full my-auto">
                    <span className="inline-block px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl mb-6 border border-slate-200">
                      {dailyQuestions[currentQIndex].chapter}
                    </span>
                    <h3 className="text-2xl md:text-4xl font-bold text-slate-800 leading-[1.5]">
                      {dailyQuestions[currentQIndex].question}
                    </h3>
                  </div>
                </div>

                {/* CỘT PHẢI: ĐÁP ÁN */}
                <div ref={rightColumnRef} className="w-full md:w-1/2 h-full overflow-y-auto flex flex-col custom-scrollbar">
                  <div className="p-8 md:p-16 max-w-2xl mx-auto w-full my-auto">
                    
                    <div className="mb-6 hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400">
                      ⌨️ Phím tắt: <kbd className="font-mono bg-white px-2 py-1 rounded shadow-sm border border-slate-200">1-4</kbd> chọn đáp án
                    </div>

                    <div className="space-y-4">
                      {dailyQuestions[currentQIndex].options.map((opt, idx) => {
                        let btnClass = "bg-white border-slate-200 text-slate-700 hover:bg-green-50 hover:border-green-300 hover:shadow-md cursor-pointer";
                        if (selectedAnswer !== null) {
                          if (idx === dailyQuestions[currentQIndex].correctAnswer) btnClass = "bg-green-50 border-green-500 text-green-800 font-bold ring-4 ring-green-100 scale-[1.02] z-10"; 
                          else if (selectedAnswer === idx) btnClass = "bg-red-50 border-red-300 text-red-700 opacity-60"; 
                          else btnClass = "bg-white border-slate-200 opacity-30 cursor-not-allowed";
                        }
                        return (
                          <button key={idx} disabled={selectedAnswer !== null} onClick={() => handleAnswer(idx)} className={`w-full p-5 rounded-2xl border-2 text-left text-lg transition-all duration-300 flex items-center gap-5 group ${btnClass}`}>
                            <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${selectedAnswer !== null && idx === dailyQuestions[currentQIndex].correctAnswer ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-green-200 group-hover:text-green-700'}`}>{idx + 1}</span>
                            <span className="leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Bù thêm khoảng trống để khi Footer hiện lên không che mất đáp án cuối */}
                    <div className="h-[250px] w-full block"></div>
                  </div>
                </div>
              </div>

              {/* --- FOOTER CỐ ĐỊNH DƯỚI ĐÁY --- */}
              <div className={`absolute bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-30 transition-transform duration-500 ease-out ${selectedAnswer !== null ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="max-w-7xl mx-auto w-full p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
                  
                  <div className="flex-1 w-full bg-blue-50 border border-blue-200 rounded-2xl p-5 max-h-[30vh] overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2 uppercase tracking-wide text-sm">
                      💡 Giải thích chi tiết
                    </h4>
                    <p className="text-blue-800 text-base md:text-lg leading-relaxed">
                      {dailyQuestions[currentQIndex]?.explanation}
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-full md:w-auto flex flex-col items-center">
                    <button onClick={nextQuestion} className="bg-green-600 hover:bg-green-700 text-white font-bold py-5 px-12 w-full rounded-2xl transition-all shadow-lg shadow-green-200 text-xl flex items-center justify-center gap-3 active:scale-95 group">
                      {currentQIndex < dailyQuestions.length - 1 ? 'Câu tiếp theo' : 'Hoàn thành bài'}
                      <span className="group-hover:translate-x-1 transition-transform">➔</span>
                    </button>
                    <span className="text-xs font-semibold text-slate-400 mt-3 hidden md:block">
                      Nhấn <kbd className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-500">Enter</kbd> hoặc <kbd className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-500">→</kbd>
                    </span>
                  </div>

                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-50">
              <div className="text-[100px] mb-8 animate-bounce">🏆</div>
              <h2 className="text-5xl font-black text-slate-800 mb-4">Tuyệt vời!</h2>
              <p className="text-2xl text-slate-500 mb-10">Đúng <b className="text-green-600">{quizScore}/{dailyQuestions.length}</b> câu hỏi hôm nay.</p>
              <div className="w-48 h-48 rounded-full border-[14px] border-green-500 flex items-center justify-center mb-12 shadow-inner bg-white">
                <span className="text-6xl font-black text-green-600">{Math.round((quizScore / dailyQuestions.length) * 100)}%</span>
              </div>
              <button onClick={finishQuiz} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-5 px-16 rounded-2xl transition-all text-2xl shadow-2xl active:scale-95">
                Lưu tiến trình (Enter)
              </button>
            </div>
          )}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes scale-up { 0% { transform: scale(0.95) translateY(10px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}