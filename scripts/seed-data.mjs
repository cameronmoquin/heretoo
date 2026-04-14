/**
 * Seed real data into Supabase.
 * Run: node scripts/seed-data.mjs
 */

const SUPABASE_URL = 'https://evryruyibfibaplzurik.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function api(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`  ERROR ${path}:`, JSON.stringify(data).slice(0, 200));
    return null;
  }
  return data;
}

async function run() {
  console.log('Seeding Pulse topics...');

  const topics = [
    { title: 'What does it mean to do your job well?', description: 'Not your title. Not your salary. The standard you actually hold yourself to.', category: 'Work', is_active: true },
    { title: 'What do we owe the people who came before us?', description: 'Heritage, debt, example, or something else entirely.', category: 'Culture', is_active: true },
    { title: 'Is consistency a virtue or a limitation?', description: 'When does staying the same protect something real. When does it prevent something necessary.', category: 'Philosophy', is_active: true },
    { title: 'What makes a community worth protecting?', description: 'Not a neighborhood. A community. What is the difference and when do you know you have one.', category: 'Community', is_active: true },
    { title: 'What does being free actually require?', description: 'Not freedom from something. Freedom for something. What is the for.', category: 'Philosophy', is_active: true },
    { title: 'What do you do when you find out you were wrong?', description: 'Not a small wrong. A years-long, fully committed, certain wrong.', category: 'Self', is_active: true },
  ];

  const createdTopics = [];
  for (const t of topics) {
    const data = await api('pulse_topics', t);
    if (data?.[0]) {
      createdTopics.push(data[0]);
      console.log(`  Topic: ${data[0].title.slice(0, 40)}... (${data[0].id})`);
    }
  }

  console.log(`\nSeeding statements for ${createdTopics.length} topics...`);

  const statementsMap = {
    0: [ // Job well
      'You read the room instead of the manual. The manual is for the situation someone anticipated. The room is the actual situation.',
      'You stay with it after everyone else has moved on. That is the whole definition.',
      'The thing does exactly what you tell it to do. No more, no less.',
      'You hold the judgment long enough for something more accurate to arrive.',
    ],
    1: [ // People before us
      'The record. You keep the record of what happened and that it mattered to both parties.',
      'Precision about what they actually did. Not the easier story.',
      'Honesty about where we were wrong about them.',
    ],
    2: [ // Consistency
      'It is an argument. It says this was intentional. I arrived here deliberately.',
      'Some things you cannot patch. You pull the whole wall and start over.',
      'The objective stays fixed. The method stays loose. Confuse those two and the mission fails.',
    ],
    3: [ // Community
      'It does not require you to become a different person to belong.',
      'People came back to it after they had real reasons not to.',
      'It is still itself. It has not been replaced by something harder.',
      'It can defend itself. Wonder without defense is not a community.',
    ],
    4: [ // Freedom
      'A choice you made yourself in a direction you named yourself with full knowledge of the cost.',
      'The willingness to be precisely yourself in a room that requires something else from you.',
    ],
    5: [ // Wrong
      'You go back to the exact moment you were certain and find where certainty exceeded evidence.',
      'You resist the urge to explain it. The explanation is almost always a continuation of the error.',
      'You separate the data from the interpretation. They require different responses.',
    ],
  };

  for (let i = 0; i < createdTopics.length; i++) {
    const topic = createdTopics[i];
    const statements = statementsMap[i] ?? [];
    for (const text of statements) {
      const data = await api('pulse_statements', {
        topic_id: topic.id,
        text,
        agree_count: Math.floor(Math.random() * 500) + 100,
        disagree_count: Math.floor(Math.random() * 100) + 10,
        pass_count: Math.floor(Math.random() * 50) + 5,
        bridging_score: Math.round((Math.random() * 0.3 + 0.65) * 100) / 100,
      });
      if (data?.[0]) {
        console.log(`  Statement: ${text.slice(0, 50)}...`);
      }
    }
  }

  console.log('\nDone seeding.');
}

run().catch(console.error);
