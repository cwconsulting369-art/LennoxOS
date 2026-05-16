import initSqlJs from 'sql.js';

export interface Workout {
  id: number;
  date: string;
  exercise: string;
  sets: number;
  reps_per_set: number;
  total_reps: number;
  calories: number;
  created_at: string;
}

export interface DailySummary {
  date: string;
  total_sets: number;
  total_reps: number;
  total_calories: number;
  exercises_done: number;
}

export interface ExerciseCount {
  exercise: string;
  sets: number;
}

export interface UserExercise {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Photo {
  id: number;
  date: string;
  type: 'face' | 'body';
  data: string;
  note: string;
  createdAt: string;
}

export interface WaterLog {
  date: string;
  amount: number;
  goal: number;
}

export interface SleepLog {
  date: string;
  hours: number;
  goal: number;
}

export interface FastingLog {
  date: string;
  fasted: boolean;
}

export interface JoggingLog {
  date: string;
  completed: boolean;
  distance: number;
}

export interface LifestyleLog {
  date: string;
  noSugar: boolean;
  coffeeCups: number;
  cigarettes: number;
}

const EXERCISES = [
  'Pushups',
  'Dips',
  'Sitzups',
  'Nacken Curls',
  'Langhantel breit curls',
  'Langhantel eng curls',
  'Schulter Presse links',
  'Schulter Presse rechts',
];

const EXERCISE_COLORS: Record<string, string> = {
  Pushups: '#00e676',
  Dips: '#00bcd4',
  Sitzups: '#ff9100',
  'Nacken Curls': '#e91e63',
  'Langhantel breit curls': '#9c27b0',
  'Langhantel eng curls': '#3f51b5',
  'Schulter Presse links': '#ff5722',
  'Schulter Presse rechts': '#4caf50',
};

const REPS_PER_SET = 10;
const KCAL_PER_REP = 0.5;

export class Database {
  private db: any = null;
  private SQL: any = null;
  private ready: boolean = false;

  async init(): Promise<void> {
    if (this.ready) return;
    try {
      this.SQL = await initSqlJs({
        locateFile: (_file: string) => './sql-wasm.wasm',
      });

      const saved = localStorage.getItem('fitness_db');
      if (saved) {
        const binary = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
        this.db = new this.SQL.Database(binary);
      } else {
        this.db = new this.SQL.Database();
        this.createTables();
        this.seedDefaultData();
      }

      this.migrateNewTables();
      this.ready = true;
    } catch (err) {
      console.error('Database init failed:', err);
      throw err;
    }
  }

  private createTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        exercise TEXT NOT NULL,
        sets INTEGER NOT NULL DEFAULT 0,
        reps_per_set INTEGER NOT NULL DEFAULT 10,
        total_reps INTEGER NOT NULL DEFAULT 0,
        calories REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS daily_summary (
        date TEXT PRIMARY KEY,
        total_sets INTEGER NOT NULL DEFAULT 0,
        total_reps INTEGER NOT NULL DEFAULT 0,
        total_calories REAL NOT NULL DEFAULT 0,
        exercises_done INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  private migrateNewTables(): void {
    // user_exercises table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // photos table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('face', 'body')),
        data TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // water_log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS water_log (
        date TEXT PRIMARY KEY,
        amount REAL NOT NULL DEFAULT 0,
        goal REAL NOT NULL DEFAULT 2.5
      )
    `);

    // sleep_log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sleep_log (
        date TEXT PRIMARY KEY,
        hours REAL NOT NULL DEFAULT 0,
        goal REAL NOT NULL DEFAULT 7.5
      )
    `);

    // fasting_log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS fasting_log (
        date TEXT PRIMARY KEY,
        fasted INTEGER NOT NULL DEFAULT 0
      )
    `);

    // jogging_log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS jogging_log (
        date TEXT PRIMARY KEY,
        completed INTEGER NOT NULL DEFAULT 0,
        distance REAL NOT NULL DEFAULT 5
      )
    `);

    // lifestyle_log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS lifestyle_log (
        date TEXT PRIMARY KEY,
        no_sugar INTEGER NOT NULL DEFAULT 0,
        coffee_cups INTEGER NOT NULL DEFAULT 0,
        cigarettes INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Seed default exercises if table is empty
    const existingExercises = this.db.exec(
      `SELECT COUNT(*) FROM user_exercises`
    );
    const count =
      existingExercises.length > 0 && existingExercises[0].values.length > 0
        ? (existingExercises[0].values[0][0] as number)
        : 0;

    if (count === 0) {
      for (const ex of EXERCISES) {
        const color = EXERCISE_COLORS[ex] || '#00e676';
        this.db.run(
          `INSERT INTO user_exercises (name, color, is_default, created_at) VALUES (?, ?, 1, datetime('now'))`,
          [ex, color]
        );
      }
      this.save();
    }
  }

  private seedDefaultData(): void {
    const today = this.getToday();
    for (const exercise of EXERCISES) {
      this.db.run(
        `INSERT INTO workouts (date, exercise, sets, reps_per_set, total_reps, calories, created_at)
         VALUES (?, ?, 0, 10, 0, 0, datetime('now'))`,
        [today, exercise]
      );
    }
    this.db.run(
      `INSERT INTO daily_summary (date, total_sets, total_reps, total_calories, exercises_done)
       VALUES (?, 0, 0, 0, 0)`,
      [today]
    );
    this.save();
  }

  getToday(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private save(): void {
    if (!this.db) return;
    const data: Uint8Array = this.db.export();
    const binary = Array.from(data) as number[];
    const base64 = btoa(String.fromCharCode(...binary));
    localStorage.setItem('fitness_db', base64);
  }

  // ============================================================
  // USER EXERCISES
  // ============================================================

  getUserExercises(): UserExercise[] {
    if (!this.db) return [];
    const result = this.db.exec(
      `SELECT id, name, color, is_default, created_at FROM user_exercises ORDER BY id`
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return EXERCISES.map((name, i) => ({
        id: i + 1,
        name,
        color: EXERCISE_COLORS[name] || '#00e676',
        isDefault: true,
        createdAt: new Date().toISOString(),
      }));
    }
    return result[0].values.map((row: any[]) => ({
      id: row[0] as number,
      name: row[1] as string,
      color: row[2] as string,
      isDefault: (row[3] as number) === 1,
      createdAt: row[4] as string,
    }));
  }

  addUserExercise(name: string, color: string): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR IGNORE INTO user_exercises (name, color, is_default, created_at) VALUES (?, ?, 0, datetime('now'))`,
      [name, color]
    );
    this.save();
  }

  deleteUserExercise(id: number): void {
    if (!this.db) return;
    const result = this.db.exec(
      `SELECT is_default, name FROM user_exercises WHERE id = ?`,
      [id]
    );
    if (result.length === 0 || result[0].values.length === 0) return;
    const isDefault = (result[0].values[0][0] as number) === 1;
    if (isDefault) return;
    const name = result[0].values[0][1] as string;
    this.db.run(`DELETE FROM user_exercises WHERE id = ?`, [id]);
    this.db.run(`DELETE FROM workouts WHERE exercise = ?`, [name]);
    this.save();
  }

  getExerciseColor(name: string): string {
    if (!this.db) return '#00e676';
    const result = this.db.exec(
      `SELECT color FROM user_exercises WHERE name = ?`,
      [name]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return EXERCISE_COLORS[name] || '#00e676';
    }
    return result[0].values[0][0] as string;
  }

  // ============================================================
  // PHOTOS
  // ============================================================

  savePhoto(date: string, type: 'face' | 'body', data: string, note: string): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO photos (date, type, data, note, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [date, type, data, note]
    );
    this.save();
  }

  getPhotos(type?: 'face' | 'body'): Photo[] {
    if (!this.db) return [];
    let sql = `SELECT id, date, type, data, note, created_at FROM photos`;
    const params: any[] = [];
    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY date DESC`;
    const result = this.db.exec(sql, params);
    if (result.length === 0 || result[0].values.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      id: row[0] as number,
      date: row[1] as string,
      type: row[2] as 'face' | 'body',
      data: row[3] as string,
      note: row[4] as string,
      createdAt: row[5] as string,
    }));
  }

  getPhotoByDate(date: string, type: 'face' | 'body'): Photo | null {
    if (!this.db) return null;
    const result = this.db.exec(
      `SELECT id, date, type, data, note, created_at FROM photos WHERE date = ? AND type = ? LIMIT 1`,
      [date, type]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return {
      id: row[0] as number,
      date: row[1] as string,
      type: row[2] as 'face' | 'body',
      data: row[3] as string,
      note: row[4] as string,
      createdAt: row[5] as string,
    };
  }

  deletePhoto(id: number): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM photos WHERE id = ?`, [id]);
    this.save();
  }

  // ============================================================
  // WATER
  // ============================================================

  getWaterLog(date: string): WaterLog {
    if (!this.db) return { date, amount: 0, goal: 2.5 };
    const result = this.db.exec(
      `SELECT amount, goal FROM water_log WHERE date = ?`,
      [date]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { date, amount: 0, goal: 2.5 };
    }
    return {
      date,
      amount: result[0].values[0][0] as number,
      goal: result[0].values[0][1] as number,
    };
  }

  addWater(date: string, amount: number): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT amount FROM water_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO water_log (date, amount, goal) VALUES (?, ?, 2.5)`,
        [date, amount]
      );
    } else {
      const current = existing[0].values[0][0] as number;
      this.db.run(
        `UPDATE water_log SET amount = ? WHERE date = ?`,
        [current + amount, date]
      );
    }
    this.save();
  }

  removeWater(date: string, amount: number): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT amount FROM water_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) return;
    const current = existing[0].values[0][0] as number;
    const newAmount = Math.max(0, current - amount);
    this.db.run(`UPDATE water_log SET amount = ? WHERE date = ?`, [
      newAmount,
      date,
    ]);
    this.save();
  }

  setWaterGoal(date: string, goal: number): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT 1 FROM water_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO water_log (date, amount, goal) VALUES (?, 0, ?)`,
        [date, goal]
      );
    } else {
      this.db.run(`UPDATE water_log SET goal = ? WHERE date = ?`, [goal, date]);
    }
    this.save();
  }

  // ============================================================
  // SLEEP
  // ============================================================

  getSleepLog(date: string): SleepLog {
    if (!this.db) return { date, hours: 0, goal: 7.5 };
    const result = this.db.exec(
      `SELECT hours, goal FROM sleep_log WHERE date = ?`,
      [date]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { date, hours: 0, goal: 7.5 };
    }
    return {
      date,
      hours: result[0].values[0][0] as number,
      goal: result[0].values[0][1] as number,
    };
  }

  setSleep(date: string, hours: number): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT 1 FROM sleep_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO sleep_log (date, hours, goal) VALUES (?, ?, 7.5)`,
        [date, hours]
      );
    } else {
      this.db.run(`UPDATE sleep_log SET hours = ? WHERE date = ?`, [
        hours,
        date,
      ]);
    }
    this.save();
  }

  setSleepGoal(date: string, goal: number): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT 1 FROM sleep_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO sleep_log (date, hours, goal) VALUES (?, 0, ?)`,
        [date, goal]
      );
    } else {
      this.db.run(`UPDATE sleep_log SET goal = ? WHERE date = ?`, [goal, date]);
    }
    this.save();
  }

  // ============================================================
  // FASTING
  // ============================================================

  getFastingLog(date: string): FastingLog {
    if (!this.db) return { date, fasted: false };
    const result = this.db.exec(
      `SELECT fasted FROM fasting_log WHERE date = ?`,
      [date]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { date, fasted: false };
    }
    return { date, fasted: (result[0].values[0][0] as number) === 1 };
  }

  toggleFasting(date: string): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT fasted FROM fasting_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO fasting_log (date, fasted) VALUES (?, 1)`,
        [date]
      );
    } else {
      const current = (existing[0].values[0][0] as number) === 1;
      this.db.run(`UPDATE fasting_log SET fasted = ? WHERE date = ?`, [
        current ? 0 : 1,
        date,
      ]);
    }
    this.save();
  }

  getFastingStreak(): number {
    if (!this.db) return 0;
    const result = this.db.exec(
      `SELECT date FROM fasting_log WHERE fasted = 1 ORDER BY date DESC`
    );
    if (result.length === 0 || result[0].values.length === 0) return 0;
    const dates = result[0].values.map((v: any[]) => v[0] as string);
    const today = this.getToday();
    let streak = 0;
    const d = new Date(today);
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  // ============================================================
  // JOGGING
  // ============================================================

  getJoggingLog(date: string): JoggingLog {
    if (!this.db) return { date, completed: false, distance: 5 };
    const result = this.db.exec(
      `SELECT completed, distance FROM jogging_log WHERE date = ?`,
      [date]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { date, completed: false, distance: 5 };
    }
    return {
      date,
      completed: (result[0].values[0][0] as number) === 1,
      distance: result[0].values[0][1] as number,
    };
  }

  toggleJogging(date: string): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT completed FROM jogging_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO jogging_log (date, completed, distance) VALUES (?, 1, 5)`,
        [date]
      );
    } else {
      const current = (existing[0].values[0][0] as number) === 1;
      this.db.run(`UPDATE jogging_log SET completed = ? WHERE date = ?`, [
        current ? 0 : 1,
        date,
      ]);
    }
    this.save();
  }

  getJoggingStreak(): number {
    if (!this.db) return 0;
    const result = this.db.exec(
      `SELECT date FROM jogging_log WHERE completed = 1 ORDER BY date DESC`
    );
    if (result.length === 0 || result[0].values.length === 0) return 0;
    const dates = result[0].values.map((v: any[]) => v[0] as string);
    const today = this.getToday();
    let streak = 0;
    const d = new Date(today);
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  shouldJogToday(): boolean {
    const lastLog = this.getJoggingDates();
    if (lastLog.length === 0) return true;
    const today = this.getToday();
    const lastDate = lastLog[0];
    const diffDays = Math.floor(
      (new Date(today).getTime() - new Date(lastDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return diffDays >= 2;
  }

  private getJoggingDates(): string[] {
    if (!this.db) return [];
    const result = this.db.exec(
      `SELECT date FROM jogging_log WHERE completed = 1 ORDER BY date DESC`
    );
    if (result.length === 0 || result[0].values.length === 0) return [];
    return result[0].values.map((v: any[]) => v[0] as string);
  }

  // ============================================================
  // LIFESTYLE
  // ============================================================

  getLifestyleLog(date: string): LifestyleLog {
    if (!this.db) return { date, noSugar: false, coffeeCups: 0, cigarettes: 0 };
    const result = this.db.exec(
      `SELECT no_sugar, coffee_cups, cigarettes FROM lifestyle_log WHERE date = ?`,
      [date]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { date, noSugar: false, coffeeCups: 0, cigarettes: 0 };
    }
    return {
      date,
      noSugar: (result[0].values[0][0] as number) === 1,
      coffeeCups: result[0].values[0][1] as number,
      cigarettes: result[0].values[0][2] as number,
    };
  }

  toggleNoSugar(date: string): void {
    if (!this.db) return;
    const existing = this.db.exec(
      `SELECT no_sugar FROM lifestyle_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO lifestyle_log (date, no_sugar, coffee_cups, cigarettes) VALUES (?, 1, 0, 0)`,
        [date]
      );
    } else {
      const current = (existing[0].values[0][0] as number) === 1;
      this.db.run(
        `UPDATE lifestyle_log SET no_sugar = ? WHERE date = ?`,
        [current ? 0 : 1, date]
      );
    }
    this.save();
  }

  setCoffeeCups(date: string, cups: number): void {
    if (!this.db) return;
    cups = Math.max(0, cups);
    const existing = this.db.exec(
      `SELECT 1 FROM lifestyle_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO lifestyle_log (date, no_sugar, coffee_cups, cigarettes) VALUES (?, 0, ?, 0)`,
        [date, cups]
      );
    } else {
      this.db.run(
        `UPDATE lifestyle_log SET coffee_cups = ? WHERE date = ?`,
        [cups, date]
      );
    }
    this.save();
  }

  setCigarettes(date: string, count: number): void {
    if (!this.db) return;
    count = Math.max(0, count);
    const existing = this.db.exec(
      `SELECT 1 FROM lifestyle_log WHERE date = ?`,
      [date]
    );
    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO lifestyle_log (date, no_sugar, coffee_cups, cigarettes) VALUES (?, 0, 0, ?)`,
        [date, count]
      );
    } else {
      this.db.run(
        `UPDATE lifestyle_log SET cigarettes = ? WHERE date = ?`,
        [count, date]
      );
    }
    this.save();
  }

  getLifestyleStats(): {
    avgCoffee7d: number;
    avgCigarettes7d: number;
    noSugarDays7d: number;
    noSugarDays30d: number;
    coffeeReduction: number;
    cigaretteReduction: number;
  } {
    if (!this.db) {
      return {
        avgCoffee7d: 0,
        avgCigarettes7d: 0,
        noSugarDays7d: 0,
        noSugarDays30d: 0,
        coffeeReduction: 0,
        cigaretteReduction: 0,
      };
    }

    const today = this.getToday();
    const days7ago = new Date(today);
    days7ago.setDate(days7ago.getDate() - 7);
    const date7ago = days7ago.toISOString().split('T')[0];

    const days30ago = new Date(today);
    days30ago.setDate(days30ago.getDate() - 30);
    const date30ago = days30ago.toISOString().split('T')[0];

    const result7d = this.db.exec(
      `SELECT COALESCE(AVG(coffee_cups), 0), COALESCE(AVG(cigarettes), 0), COALESCE(SUM(no_sugar), 0)
       FROM lifestyle_log WHERE date > ?`,
      [date7ago]
    );
    const result30d = this.db.exec(
      `SELECT COALESCE(SUM(no_sugar), 0) FROM lifestyle_log WHERE date > ?`,
      [date30ago]
    );

    const avgCoffee7d =
      result7d.length > 0 && result7d[0].values.length > 0
        ? Math.round((result7d[0].values[0][0] as number) * 10) / 10
        : 0;
    const avgCigarettes7d =
      result7d.length > 0 && result7d[0].values.length > 0
        ? Math.round((result7d[0].values[0][1] as number) * 10) / 10
        : 0;
    const noSugarDays7d =
      result7d.length > 0 && result7d[0].values.length > 0
        ? (result7d[0].values[0][2] as number) || 0
        : 0;
    const noSugarDays30d =
      result30d.length > 0 && result30d[0].values.length > 0
        ? (result30d[0].values[0][0] as number) || 0
        : 0;

    // Calculate reduction: compare first 3 days vs last 3 days of 7-day period
    const first3 = this.db.exec(
      `SELECT COALESCE(AVG(coffee_cups), 0), COALESCE(AVG(cigarettes), 0)
       FROM lifestyle_log WHERE date > ? AND date <= ?`,
      [date7ago, this.getOffsetDate(-4)]
    );
    const last3 = this.db.exec(
      `SELECT COALESCE(AVG(coffee_cups), 0), COALESCE(AVG(cigarettes), 0)
       FROM lifestyle_log WHERE date > ?`,
      [this.getOffsetDate(-3)]
    );

    const firstCoffee =
      first3.length > 0 && first3[0].values.length > 0
        ? (first3[0].values[0][0] as number) || 0
        : 0;
    const lastCoffee =
      last3.length > 0 && last3[0].values.length > 0
        ? (last3[0].values[0][0] as number) || 0
        : 0;
    const firstCig =
      first3.length > 0 && first3[0].values.length > 0
        ? (first3[0].values[0][1] as number) || 0
        : 0;
    const lastCig =
      last3.length > 0 && last3[0].values.length > 0
        ? (last3[0].values[0][1] as number) || 0
        : 0;

    const coffeeReduction =
      firstCoffee > 0 ? Math.round(((firstCoffee - lastCoffee) / firstCoffee) * 100) : 0;
    const cigaretteReduction =
      firstCig > 0 ? Math.round(((firstCig - lastCig) / firstCig) * 100) : 0;

    return {
      avgCoffee7d,
      avgCigarettes7d,
      noSugarDays7d,
      noSugarDays30d,
      coffeeReduction,
      cigaretteReduction,
    };
  }

  private getOffsetDate(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }

  // ============================================================
  // EXISTING METHODS
  // ============================================================

  getTodayWorkouts(): ExerciseCount[] {
    if (!this.db) return [];
    const today = this.getToday();
    const result = this.db.exec(
      `SELECT exercise, sets FROM workouts WHERE date = ?`,
      [today]
    );

    const allExercises = this.getUserExercises();

    if (result.length === 0 || result[0].values.length === 0) {
      return allExercises.map((e) => ({ exercise: e.name, sets: 0 }));
    }

    const counts: Record<string, number> = {};
    for (const row of result[0].values) {
      counts[row[0] as string] = row[1] as number;
    }

    return allExercises.map((e) => ({
      exercise: e.name,
      sets: counts[e.name] ?? 0,
    }));
  }

  incrementSet(exercise: string): void {
    if (!this.db) return;
    const today = this.getToday();

    const existing = this.db.exec(
      `SELECT id, sets FROM workouts WHERE date = ? AND exercise = ?`,
      [today, exercise]
    );

    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO workouts (date, exercise, sets, reps_per_set, total_reps, calories, created_at)
         VALUES (?, ?, 1, 10, 10, 5.0, datetime('now'))`,
        [today, exercise]
      );
    } else {
      const id = existing[0].values[0][0] as number;
      const currentSets = (existing[0].values[0][1] as number) + 1;
      const totalReps = currentSets * REPS_PER_SET;
      const calories = totalReps * KCAL_PER_REP;
      this.db.run(
        `UPDATE workouts SET sets = ?, total_reps = ?, calories = ? WHERE id = ?`,
        [currentSets, totalReps, calories, id]
      );
    }

    this.updateDailySummary(today);
    this.save();
  }

  decrementSet(exercise: string): void {
    if (!this.db) return;
    const today = this.getToday();

    const existing = this.db.exec(
      `SELECT id, sets FROM workouts WHERE date = ? AND exercise = ?`,
      [today, exercise]
    );

    if (existing.length === 0 || existing[0].values.length === 0) return;

    const id = existing[0].values[0][0] as number;
    const currentSets = (existing[0].values[0][1] as number) - 1;
    if (currentSets < 0) return;

    const totalReps = currentSets * REPS_PER_SET;
    const calories = totalReps * KCAL_PER_REP;
    this.db.run(
      `UPDATE workouts SET sets = ?, total_reps = ?, calories = ? WHERE id = ?`,
      [currentSets, totalReps, calories, id]
    );

    this.updateDailySummary(today);
    this.save();
  }

  private updateDailySummary(date: string): void {
    const result = this.db.exec(
      `SELECT 
        COALESCE(SUM(sets), 0) as total_sets,
        COALESCE(SUM(total_reps), 0) as total_reps,
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(COUNT(CASE WHEN sets > 0 THEN 1 END), 0) as exercises_done
       FROM workouts WHERE date = ?`,
      [date]
    );

    const values = result[0]?.values[0] ?? [0, 0, 0, 0];
    const totalSets = values[0] as number;
    const totalReps = values[1] as number;
    const totalCalories = values[2] as number;
    const exercisesDone = values[3] as number;

    const exists = this.db.exec(
      `SELECT 1 FROM daily_summary WHERE date = ?`,
      [date]
    );

    if (exists.length === 0 || exists[0].values.length === 0) {
      this.db.run(
        `INSERT INTO daily_summary (date, total_sets, total_reps, total_calories, exercises_done)
         VALUES (?, ?, ?, ?, ?)`,
        [date, totalSets, totalReps, totalCalories, exercisesDone]
      );
    } else {
      this.db.run(
        `UPDATE daily_summary SET total_sets = ?, total_reps = ?, total_calories = ?, exercises_done = ?
         WHERE date = ?`,
        [totalSets, totalReps, totalCalories, exercisesDone, date]
      );
    }
  }

  getTodayStats(): {
    totalReps: number;
    totalCalories: number;
    totalSets: number;
  } {
    if (!this.db) return { totalReps: 0, totalCalories: 0, totalSets: 0 };
    const today = this.getToday();
    const result = this.db.exec(
      `SELECT COALESCE(SUM(total_reps), 0), COALESCE(SUM(calories), 0), COALESCE(SUM(sets), 0)
       FROM workouts WHERE date = ?`,
      [today]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { totalReps: 0, totalCalories: 0, totalSets: 0 };
    }
    return {
      totalReps: result[0].values[0][0] as number,
      totalCalories: result[0].values[0][1] as number,
      totalSets: result[0].values[0][2] as number,
    };
  }

  getAllTimeStats(): { totalReps: number; totalSets: number } {
    if (!this.db) return { totalReps: 0, totalSets: 0 };
    const result = this.db.exec(
      `SELECT COALESCE(SUM(total_reps), 0), COALESCE(SUM(sets), 0) FROM workouts`
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return { totalReps: 0, totalSets: 0 };
    }
    return {
      totalReps: result[0].values[0][0] as number,
      totalSets: result[0].values[0][1] as number,
    };
  }

  getStreak(): number {
    if (!this.db) return 0;
    const result = this.db.exec(
      `SELECT date FROM daily_summary WHERE total_sets > 0 ORDER BY date DESC`
    );
    if (result.length === 0 || result[0].values.length === 0) return 0;

    const activeDates = result[0].values.map((v: any[]) => v[0] as string);
    const today = this.getToday();

    if (!activeDates.includes(today)) return 0;

    let streak = 0;
    const d = new Date(today);

    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (activeDates.includes(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  getLast7Days(): { date: string; label: string; totalReps: number }[] {
    if (!this.db) return [];
    const days: { date: string; label: string; totalReps: number }[] = [];
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = dayNames[d.getDay()];

      const result = this.db.exec(
        `SELECT COALESCE(SUM(total_reps), 0) FROM workouts WHERE date = ?`,
        [dateStr]
      );

      const reps =
        result.length > 0 && result[0].values.length > 0
          ? (result[0].values[0][0] as number)
          : 0;

      days.push({ date: dateStr, label, totalReps: reps });
    }

    return days;
  }

  getHistory(limit: number = 30): Workout[] {
    if (!this.db) return [];
    const result = this.db.exec(
      `SELECT id, date, exercise, sets, reps_per_set, total_reps, calories, created_at
       FROM workouts WHERE sets > 0 ORDER BY date DESC, exercise DESC LIMIT ?`,
      [limit]
    );
    if (result.length === 0 || result[0].values.length === 0) return [];

    return result[0].values.map((row: any[]) => ({
      id: row[0] as number,
      date: row[1] as string,
      exercise: row[2] as string,
      sets: row[3] as number,
      reps_per_set: row[4] as number,
      total_reps: row[5] as number,
      calories: row[6] as number,
      created_at: row[7] as string,
    }));
  }

  ensureTodayEntry(): void {
    if (!this.db) return;
    const today = this.getToday();

    const existing = this.db.exec(
      `SELECT 1 FROM daily_summary WHERE date = ?`,
      [today]
    );

    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO daily_summary (date, total_sets, total_reps, total_calories, exercises_done)
         VALUES (?, 0, 0, 0, 0)`,
        [today]
      );
    }

    // Ensure workout entries for today for all exercises
    const exercises = this.getUserExercises();
    for (const exercise of exercises) {
      const ex = this.db.exec(
        `SELECT 1 FROM workouts WHERE date = ? AND exercise = ?`,
        [today, exercise.name]
      );
      if (ex.length === 0 || ex[0].values.length === 0) {
        this.db.run(
          `INSERT INTO workouts (date, exercise, sets, reps_per_set, total_reps, calories, created_at)
           VALUES (?, ?, 0, 10, 0, 0, datetime('now'))`,
          [today, exercise.name]
        );
      }
    }

    this.save();
  }

  // ============================================================
  // DATA IMPORT / EXPORT
  // ============================================================

  exportDatabase(): Uint8Array {
    if (!this.db) return new Uint8Array();
    return this.db.export();
  }

  importDatabase(data: Uint8Array): void {
    if (!this.SQL) return;
    this.db = new this.SQL.Database(data);
    this.save();
  }

  resetAllData(): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM workouts`);
    this.db.run(`DELETE FROM daily_summary`);
    this.db.run(`DELETE FROM photos`);
    this.db.run(`DELETE FROM water_log`);
    this.db.run(`DELETE FROM sleep_log`);
    this.db.run(`DELETE FROM fasting_log`);
    this.db.run(`DELETE FROM jogging_log`);
    this.db.run(`DELETE FROM lifestyle_log`);
    this.db.run(`DELETE FROM user_exercises WHERE is_default = 0`);
    this.save();
  }
}

export const exercises = EXERCISES;
export const repsPerSet = REPS_PER_SET;
export const kcalPerRep = KCAL_PER_REP;
