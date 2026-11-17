
import { useEffect, useState } from 'react';
import { topics } from './data/topics.js';
import questions from './data/questions/index.js';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

async function call(path, opts = {}) {
    const token = localStorage.getItem('dono-token');

    const response = await fetch(API + path, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Server bilan bog‘lanishda xatolik');
    }

    return data;
}

const levelNames = {
    easy: 'Oson',
    medium: 'O‘rta',
    hard: 'Qiyin'
};

export default function App() {
    const [user, setUser] = useState(null);
    const [mode, setMode] = useState('register');
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        password: ''
    });

    const [err, setErr] = useState('');
    const [progress, setProgress] = useState({});
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState('home');
    const [topic, setTopic] = useState(null);
    const [stage, setStage] = useState('video');

    const [idx, setIdx] = useState(0);
    const [chosen, setChosen] = useState(null);
    const [score, setScore] = useState(0);
    const [last, setLast] = useState(null);
    const [wc, setWc] = useState(false);

    const [chosenTopics, setChosenTopics] = useState(
        topics.map(t => t.id)
    );
    const [count, setCount] = useState(10);
    const [ct, setCt] = useState([]);
    const [ci, setCi] = useState(0);
    const [ca, setCa] = useState([]);
    const [cr, setCr] = useState(null);

    const token = localStorage.getItem('dono-token');

    useEffect(() => {
        async function initialize() {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const data = await call('/me');
                setUser(data.user);

                const savedProgress = await call('/progress');
                setProgress(savedProgress || {});
            } catch (error) {
                localStorage.removeItem('dono-token');
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    async function loadProgress() {
        const data = await call('/progress');
        setProgress(data || {});
    }

    async function save(patch) {
        if (!topic) return;

        const data = await call(`/progress/${topic.id}`, {
            method: 'POST',
            body: JSON.stringify(patch)
        });

        setProgress(old => ({
            ...old,
            [topic.id]: data
        }));

        return data;
    }

    async function auth(e) {
        e.preventDefault();
        setErr('');

        try {
            const data = await call(`/auth/${mode}`, {
                method: 'POST',
                body: JSON.stringify(form)
            });

            localStorage.setItem('dono-token', data.token);
            setUser(data.user);

            const savedProgress = await call('/progress');
            setProgress(savedProgress || {});
        } catch (error) {
            setErr(error.message);
        }
    }

    function logout() {
        localStorage.removeItem('dono-token');
        setUser(null);
        setPage('home');
        setProgress({});
    }

    function openTopic(selectedTopic) {
        const saved = progress[selectedTopic.id] || {};

        setTopic(selectedTopic);
        setPage('lesson');
        setIdx(0);
        setChosen(null);
        setScore(0);
        setLast(null);
        setWc(false);

        // O‘quvchi avval qayergacha kelgan bo‘lsa, shu yerdan davom etadi.
        if (saved.wordwallDone) {
            setStage('summary');
        } else if (saved.hardDone) {
            setStage('wordwall');
        } else if (saved.mediumDone) {
            setStage('hard');
        } else if (saved.easyDone) {
            setStage('medium');
        } else if (saved.videoDone) {
            setStage('easy');
        } else {
            setStage('video');
        }
    }

    function replayVideo() {
        setStage('video');
        setIdx(0);
        setChosen(null);
        setScore(0);
        setLast(null);
        setWc(false);
    }

    async function beginLevel() {
        if (stage !== 'video') return;

        try {
            await save({ videoDone: true });
            setStage('easy');
            setIdx(0);
            setScore(0);
            setChosen(null);

            setTimeout(() => {
                document.getElementById('work')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 150);
        } catch (error) {
            setErr(error.message);
        }
    }

    const currentQuestions =
        topic && ['easy', 'medium', 'hard'].includes(stage)
            ? questions[topic.id]?.[stage] || []
            : [];

    const currentQuestion = currentQuestions[idx];

    async function answer(optionIndex) {
        if (chosen !== null || !currentQuestion) return;

        setChosen(optionIndex);

        const newScore =
            score + (optionIndex === currentQuestion[2] ? 1 : 0);

        setScore(newScore);

        setTimeout(async () => {
            if (idx + 1 < currentQuestions.length) {
                setIdx(old => old + 1);
                setChosen(null);
            } else {
                const percent = Math.round(
                    (newScore / currentQuestions.length) * 100
                );

                setLast({
                    score: percent,
                    correct: newScore,
                    total: currentQuestions.length
                });

                try {
                    await save({
                        [`${stage}Done`]: true,
                        [`${stage}Score`]: percent
                    });
                } catch (error) {
                    setErr(error.message);
                }
            }
        }, 750);
    }

    function nextLevel() {
        const levels = ['easy', 'medium', 'hard'];
        const currentIndex = levels.indexOf(stage);

        setLast(null);
        setChosen(null);
        setIdx(0);
        setScore(0);

        if (currentIndex < 2) {
            setStage(levels[currentIndex + 1]);
        } else {
            setStage('wordwall');
        }
    }

    async function finishWordwall() {
        try {
            await save({ wordwallDone: true });
            setStage('summary');
        } catch (error) {
            setErr(error.message);
        }
    }

    function beginControlTest() {
        const pool = chosenTopics.flatMap(id =>
            ['easy', 'medium', 'hard'].flatMap(level =>
                (questions[id]?.[level] || []).map(question => ({
                    ...question,
                    topic: id
                }))
            )
        );

        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, pool.length));

        if (!selected.length) {
            setErr('Tanlangan mavzularda savollar topilmadi.');
            return;
        }

        setErr('');
        setCt(selected);
        setCi(0);
        setCa([]);
        setCr(null);
        setPage('controltest');
    }

    function controlAnswer(optionIndex) {
        if (ca[ci] !== undefined || !ct[ci]) return;

        const updatedAnswers = [...ca, optionIndex];
        setCa(updatedAnswers);

        if (ci < ct.length - 1) {
            setCi(old => old + 1);
        } else {
            const correct = updatedAnswers.reduce(
                (total, answerIndex, questionIndex) =>
                    total + (answerIndex === ct[questionIndex][2] ? 1 : 0),
                0
            );

            setCr({
                correct,
                total: ct.length
            });
        }
    }

    if (loading) {
        return (
            <div className="app">
                <main className="auth-page">
                    <div className="auth-card">
                        <h2>Dono edu</h2>
                        <p>Yuklanmoqda...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="app">
                <main className="auth-page">
                    <form className="auth-card" onSubmit={auth}>
                        <div className="logo-icon">📚</div>
                        <h1>Dono edu</h1>
                        <p>Bilim sari birgalikda!</p>

                        <div className="question-count-options">
                            <button
                                type="button"
                                className={`count-option ${mode === 'register' ? 'active' : ''}`}
                                onClick={() => {
                                    setMode('register');
                                    setErr('');
                                }}
                            >
                                Ro‘yxatdan o‘tish
                            </button>

                            <button
                                type="button"
                                className={`count-option ${mode === 'login' ? 'active' : ''}`}
                                onClick={() => {
                                    setMode('login');
                                    setErr('');
                                }}
                            >
                                Kirish
                            </button>
                        </div>

                        {mode === 'register' && (
                            <>
                                <label>Ism</label>
                                <input
                                    required
                                    placeholder="Ismingiz"
                                    value={form.firstName}
                                    onChange={e =>
                                        setForm({ ...form, firstName: e.target.value })
                                    }
                                />

                                <label>Familiya</label>
                                <input
                                    required
                                    placeholder="Familiyangiz"
                                    value={form.lastName}
                                    onChange={e =>
                                        setForm({ ...form, lastName: e.target.value })
                                    }
                                />
                            </>
                        )}

                        {mode === 'login' && (
                            <>
                                <label>Ism</label>
                                <input
                                    required
                                    placeholder="Ismingiz"
                                    value={form.firstName}
                                    onChange={e =>
                                        setForm({ ...form, firstName: e.target.value })
                                    }
                                />

                                <label>Familiya</label>
                                <input
                                    required
                                    placeholder="Familiyangiz"
                                    value={form.lastName}
                                    onChange={e =>
                                        setForm({ ...form, lastName: e.target.value })
                                    }
                                />
                            </>
                        )}

                        <label>Parol</label>
                        <input
                            required
                            minLength={6}
                            type="password"
                            placeholder="Parolingiz"
                            value={form.password}
                            onChange={e =>
                                setForm({ ...form, password: e.target.value })
                            }
                        />

                        {err && <p className="error-message">{err}</p>}

                        <button className="primary-button" type="submit">
                            {mode === 'register' ? 'Hisob yaratish' : 'Kirish'}
                        </button>
                    </form>
                </main>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="navbar">
                <button className="logo" onClick={() => setPage('home')}>
                    <span className="logo-icon">📚</span>
                    <span>Dono <b>edu</b></span>
                </button>

                <div className="nav-label">
                    <span className="online-dot" />
                    {user.firstName} {user.lastName}
                </div>

                <button className="nav-button" onClick={logout}>
                    Chiqish
                </button>
            </header>

            <main>
                {page === 'home' && (
                    <>
                        <section className="hero">
                            <div className="hero-content">
                                <div className="welcome-tag">
                                    ✨ XUSH KELIBSAN, {user.firstName.toUpperCase()}!
                                </div>

                                <h1>
                                    Bilim olish
                                    <span>qiziqarli!</span>
                                </h1>

                                <p>
                                    Yangi mavzularni o‘rgan, qiziqarli topshiriqlarni
                                    bajар va bilimingni sinab ko‘r.
                                </p>

                                <button
                                    className="hero-button"
                                    onClick={() =>
                                        document.getElementById('topics')?.scrollIntoView({
                                            behavior: 'smooth'
                                        })
                                    }
                                >
                                    Darslarni boshlash <span>→</span>
                                </button>

                                <div className="hero-note">
                                    ⭐ Har kuni ozgina o‘rgan — katta natijaga erish!
                                </div>
                            </div>

                            <div className="hero-art">
                                <div className="art-circle" />
                                <div className="book-illustration">
                                    <span style={{ fontSize: 85 }}>📖</span>
                                </div>
                                <div className="math-float math-one">2 + 3 = ?</div>
                                <div className="math-float math-two">x + 5</div>
                                <div className="math-float math-three">A + B</div>
                                <span className="art-star star-one">✦</span>
                                <span className="art-star star-two">✧</span>
                                <span className="art-star star-three">✦</span>
                            </div>
                        </section>

                        <section className="topics-section" id="topics">
                            <div className="section-heading">
                                <div>
                                    <div className="section-kicker">BILIM OLAMIGA SAYOHAT</div>
                                    <h2>Mavzular</h2>
                                    <p>O‘zingga kerakli mavzuni tanla va o‘rganishni boshla.</p>
                                </div>

                                <div className="topic-count">
                                    📘 {topics.length} ta mavzu
                                </div>
                            </div>

                            <div className="topics-grid">
                                {topics.map((item, index) => {
                                    const saved = progress[item.id] || {};
                                    const completed = Boolean(saved.wordwallDone);
                                    const started = Boolean(
                                        saved.videoDone ||
                                        saved.easyDone ||
                                        saved.mediumDone ||
                                        saved.hardDone
                                    );

                                    const colors = [
                                        'blue',
                                        'purple',
                                        'orange',
                                        'green',
                                        'pink',
                                        'yellow'
                                    ];

                                    return (
                                        <article
                                            className={`topic-card ${colors[index % colors.length]}`}
                                            key={item.id}
                                        >
                                            <div className="card-top">
                                                <div className="topic-icon">
                                                    <span style={{ fontSize: 25 }}>
                                                        {['➕', '🔤', '🟰', '📐', '📊', '🧮'][index % 6]}
                                                    </span>
                                                </div>
                                                <span className="topic-number">
                                                    0{index + 1}
                                                </span>
                                            </div>

                                            <div className="topic-info">
                                                <div className="grade-label">
                                                    {item.grade || 'Matematika'}
                                                </div>
                                                <h3>{item.title}</h3>
                                                <p>
                                                    {completed
                                                        ? 'Bu mavzu yakunlangan.'
                                                        : started
                                                            ? 'Darsni davom ettirishing mumkin.'
                                                            : 'Yangi mavzuni o‘rganishni boshlang.'}
                                                </p>
                                            </div>

                                            <div className="status">
                                                {completed
                                                    ? '✓ Yakunlandi'
                                                    : started
                                                        ? 'Jarayonda'
                                                        : 'Boshlanmagan'}
                                            </div>

                                            <button
                                                className="topic-button"
                                                onClick={() => openTopic(item)}
                                            >
                                                {completed
                                                    ? 'Qayta ko‘rish'
                                                    : started
                                                        ? 'Davom etish'
                                                        : 'Boshlash'}
                                                <span>→</span>
                                            </button>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="bottom-banner">
                            <div className="banner-icon">💡</div>
                            <div>
                                <h3>Bilimingni sinab ko‘r!</h3>
                                <p>
                                    Barcha mavzulardan nazorat ishi ishlashing mumkin.
                                </p>
                            </div>
                            <span className="banner-sparkle">✦</span>
                        </section>

                        <section className="control-test-page">
                            <div className="control-test-panel">
                                <div className="teacher-settings-title">
                                    <span>📝</span>
                                    <h2>Nazorat ishi</h2>
                                </div>

                                <p>
                                    Mavzularni tanla va 10 yoki 15 ta savoldan iborat
                                    nazorat ishini bajar.
                                </p>

                                <label>
                                    <input
                                        type="checkbox"
                                        checked={chosenTopics.length === topics.length}
                                        onChange={e =>
                                            setChosenTopics(
                                                e.target.checked ? topics.map(t => t.id) : []
                                            )
                                        }
                                    />
                                    Barcha mavzularni tanlash
                                </label>

                                <div className="grid" style={{ marginTop: 15 }}>
                                    {topics.map(item => (
                                        <label key={item.id}>
                                            <input
                                                type="checkbox"
                                                checked={chosenTopics.includes(item.id)}
                                                onChange={e =>
                                                    setChosenTopics(old =>
                                                        e.target.checked
                                                            ? [...old, item.id]
                                                            : old.filter(id => id !== item.id)
                                                    )
                                                }
                                            />
                                            {item.title}
                                        </label>
                                    ))}
                                </div>

                                <div className="question-count-options">
                                    {[10, 15].map(number => (
                                        <button
                                            key={number}
                                            className={`count-option ${count === number ? 'active' : ''}`}
                                            onClick={() => setCount(number)}
                                        >
                                            {number} ta savol
                                        </button>
                                    ))}
                                </div>

                                <p className="settings-note">
                                    Tanlangan mavzulardan tasodifiy savollar olinadi.
                                </p>

                                {err && <p className="error-message">{err}</p>}

                                <button
                                    className="primary-button"
                                    disabled={!chosenTopics.length}
                                    onClick={beginControlTest}
                                >
                                    Nazorat ishini boshlash →
                                </button>
                            </div>
                        </section>
                    </>
                )}

                {page === 'lesson' && topic && (
                    <section className="lesson-page">
                        <button
                            className="back-button"
                            onClick={() => {
                                setPage('home');
                                loadProgress().catch(() => { });
                            }}
                        >
                            ← Mavzularga qaytish
                        </button>

                        <div className="lesson-heading">
                            <div className="section-kicker">DONO EDU · DARS</div>
                            <h1>{topic.grade || 'Matematika'}</h1>
                            <h2>{topic.title}</h2>
                            <p>Videoni tomosha qil va topshiriqlarni bajar.</p>
                        </div>

                        {stage !== 'video' && (
                            <button
                                className="primary-button"
                                onClick={replayVideo}
                            >
                                🎬 Videoni qayta ko‘rish
                            </button>
                        )}

                        {stage === 'video' && (
                            <>
                                <div className="lesson-video">
                                    <video
                                        controls
                                        playsInline
                                        src={topic.video}
                                        onEnded={beginLevel}
                                    />
                                </div>

                                <div className="lesson-intro">
                                    <div className="intro-icon">🎬</div>
                                    <div>
                                        <h3>Videodars</h3>
                                        <p>
                                            Videoni oxirigacha tomosha qil. Video tugagach
                                            topshiriqlar avtomatik ochiladi.
                                        </p>
                                    </div>
                                </div>

                                <div className="lesson-next">
                                    <h3>Tayyor bo‘ldingmi?</h3>
                                    <p>
                                        Agar videoni avval ko‘rgan bo‘lsang, topshiriqlarga
                                        o‘tishing mumkin.
                                    </p>
                                    <button className="primary-button" onClick={beginLevel}>
                                        Topshiriqlarni boshlash →
                                    </button>
                                </div>
                            </>
                        )}

                        <section className="test-panel" id="work">
                            {['easy', 'medium', 'hard'].includes(stage) && (
                                <>
                                    <div className="test-topline">
                                        <span>{levelNames[stage]} daraja</span>
                                        <span>
                                            {currentQuestions.length
                                                ? `${idx + 1} / ${currentQuestions.length}`
                                                : 'Savollar yo‘q'}
                                        </span>
                                    </div>

                                    <div className="test-progress">
                                        <div
                                            className="test-progress-fill"
                                            style={{
                                                width: currentQuestions.length
                                                    ? `${((idx + 1) / currentQuestions.length) * 100}%`
                                                    : '0%'
                                            }}
                                        />
                                    </div>

                                    {currentQuestion ? (
                                        <>
                                            <div className="section-kicker">
                                                {levelNames[stage].toUpperCase()} TOPSHIRIQ
                                            </div>
                                            <h3>{currentQuestion[0]}</h3>

                                            <div className="test-answers">
                                                {currentQuestion[1].map((option, optionIndex) => {
                                                    const isCorrect = optionIndex === currentQuestion[2];

                                                    let className = 'test-answer';

                                                    if (chosen !== null && isCorrect) {
                                                        className += ' correct';
                                                    } else if (
                                                        chosen === optionIndex &&
                                                        !isCorrect
                                                    ) {
                                                        className += ' incorrect';
                                                    }

                                                    return (
                                                        <button
                                                            key={optionIndex}
                                                            className={className}
                                                            disabled={chosen !== null}
                                                            onClick={() => answer(optionIndex)}
                                                        >
                                                            <span className="answer-letter">
                                                                {String.fromCharCode(65 + optionIndex)}
                                                            </span>
                                                            {option}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {chosen !== null && (
                                                <p className="answer-feedback">
                                                    {chosen === currentQuestion[2]
                                                        ? 'Barakalla! 🎉'
                                                        : 'Yana harakat qilib ko‘r, uddalaysan!'}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p>
                                            Bu daraja uchun savollar topilmadi. Savollar
                                            faylini tekshirish kerak.
                                        </p>
                                    )}
                                </>
                            )}

                            {last && (
                                <div className="result-panel">
                                    <div className="result-icon">🏆</div>
                                    <div className="section-kicker">DARAJA YAKUNLANDI</div>
                                    <h2>Barakalla!</h2>
                                    <div className="result-percent">{last.score}%</div>
                                    <p>
                                        {last.correct} ta to‘g‘ri / {last.total} ta savol
                                    </p>

                                    <div className="result-actions">
                                        <button
                                            className="primary-button"
                                            onClick={nextLevel}
                                        >
                                            {stage === 'hard'
                                                ? 'Wordwall o‘yiniga o‘tish'
                                                : 'Keyingi daraja'}
                                            →
                                        </button>
                                        <button
                                            className="back-button"
                                            onClick={() => window.print()}
                                        >
                                            PDF saqlash
                                        </button>
                                    </div>
                                </div>
                            )}

                            {stage === 'wordwall' && (
                                <div className="wordwall-panel">
                                    <div className="section-kicker">MUSTAHKAMLASH</div>
                                    <h2>Wordwall o‘yini 🎮</h2>
                                    <p>
                                        O‘rgangan mavzuingni qiziqarli o‘yin orqali
                                        mustahkamla.
                                    </p>

                                    {topic.wordwallUrl ? (
                                        <iframe
                                            className="wordwall-frame"
                                            title="Wordwall o‘yini"
                                            src={topic.wordwallUrl}
                                            allowFullScreen
                                        />
                                    ) : (
                                        <p>
                                            Wordwall havolasi topics.js fayliga kiritilmagan.
                                        </p>
                                    )}

                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={wc}
                                            onChange={e => setWc(e.target.checked)}
                                        />
                                        O‘yinni bajardim
                                    </label>

                                    <button
                                        className="primary-button"
                                        disabled={!wc}
                                        onClick={finishWordwall}
                                    >
                                        Natijani ko‘rish →
                                    </button>
                                </div>
                            )}

                            {stage === 'summary' && (
                                <div className="result-panel">
                                    <div className="result-icon">🎉</div>
                                    <div className="section-kicker">MAVZU YAKUNLANDI</div>
                                    <h2>Barakalla!</h2>
                                    <p>{topic.title} mavzusini yakunlading.</p>

                                    <div className="homework-panel">
                                        <p>
                                            Oson: {progress[topic.id]?.easyScore ?? 0}%
                                        </p>
                                        <p>
                                            O‘rta: {progress[topic.id]?.mediumScore ?? 0}%
                                        </p>
                                        <p>
                                            Qiyin: {progress[topic.id]?.hardScore ?? 0}%
                                        </p>
                                        <p>Wordwall: bajarildi ✓</p>
                                    </div>

                                    <div className="result-actions">
                                        <button
                                            className="back-button"
                                            onClick={() => window.print()}
                                        >
                                            PDF saqlash
                                        </button>
                                        <button
                                            className="primary-button"
                                            onClick={() => setStage('homework')}
                                        >
                                            Uyga vazifa →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {stage === 'homework' && (
                                <div className="homework-panel">
                                    <div className="result-icon">🏡</div>
                                    <div className="section-kicker">UYGA VAZIFA</div>
                                    <h2>Ota-onangiz bilan birgalikda!</h2>

                                    <p>
                                        Bugun o‘rgangan mavzuingizga oid 3 ta misol
                                        tuzing va ularni mustaqil yeching.
                                    </p>

                                    <h3>Ota-onalar uchun</h3>
                                    <p>
                                        Farzandingizga misollarni yechishda yordam bering.
                                        Javobni darhol aytib bermang, mustaqil fikrlashiga
                                        imkon yarating.
                                    </p>

                                    <button
                                        className="back-button"
                                        onClick={() => window.print()}
                                    >
                                        PDF saqlash
                                    </button>

                                    <h2>Ota-onangizga tashakkur! ❤️</h2>

                                    <button
                                        className="primary-button"
                                        onClick={() => setPage('home')}
                                    >
                                        Bosh sahifaga qaytish
                                    </button>
                                </div>
                            )}

                            {err && <p className="error-message">{err}</p>}
                        </section>
                    </section>
                )}

                {page === 'controltest' && (
                    <section className="control-test-page">
                        <button
                            className="back-button"
                            onClick={() => setPage('home')}
                        >
                            ← Bosh sahifa
                        </button>

                        {!cr && ct[ci] && (
                            <div className="test-panel">
                                <div className="test-topline">
                                    <span>NAZORAT ISHI</span>
                                    <span>
                                        {ci + 1} / {ct.length}
                                    </span>
                                </div>

                                <div className="test-progress">
                                    <div
                                        className="test-progress-fill"
                                        style={{
                                            width: `${((ci + 1) / ct.length) * 100}%`
                                        }}
                                    />
                                </div>

                                <h3>{ct[ci][0]}</h3>

                                <div className="test-answers">
                                    {ct[ci][1].map((option, optionIndex) => (
                                        <button
                                            key={optionIndex}
                                            className="test-answer"
                                            disabled={ca[ci] !== undefined}
                                            onClick={() => controlAnswer(optionIndex)}
                                        >
                                            <span className="answer-letter">
                                                {String.fromCharCode(65 + optionIndex)}
                                            </span>
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {cr && (
                            <div className="result-panel">
                                <div className="result-icon">🏆</div>
                                <div className="section-kicker">NAZORAT ISHI NATIJASI</div>
                                <h2>Test yakunlandi!</h2>

                                <div className="result-percent">
                                    {Math.round((cr.correct / cr.total) * 100)}%
                                </div>

                                <p>
                                    {cr.correct} ta to‘g‘ri javob, jami {cr.total} ta savol.
                                </p>

                                <div className="result-actions">
                                    <button
                                        className="back-button"
                                        onClick={() => window.print()}
                                    >
                                        PDF saqlash
                                    </button>
                                    <button
                                        className="primary-button"
                                        onClick={() => setPage('home')}
                                    >
                                        Bosh sahifaga qaytish
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            <footer>
                <div className="footer-logo">
                    Dono <b>edu</b>
                </div>
                <p>Bilim sari birgalikda! © 2026</p>
            </footer>
        </div>
    );
}
