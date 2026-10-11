import type { Resource, Progress, StudySet } from "./domain";
export const demoResources: Resource[] = [
  {
    id: "demo-assessment",
    owner_id: "demo",
    title: "Patient assessment essentials",
    topic: "Patient assessment",
    content:
      "Original sample study notes. Scene size-up includes scene safety, appropriate protective equipment, mechanism of injury or nature of illness, number of patients, and need for additional resources. The primary assessment identifies immediate life threats. Reassessment looks for changes in the patient and response to interventions. Follow your course materials and local protocols.",
    visibility: "private",
    rights: "original",
  },
  {
    id: "demo-communication",
    owner_id: "demo",
    title: "A better patient handoff",
    topic: "EMS operations",
    content:
      "Original sample study notes. A structured handoff communicates the chief complaint, relevant history, assessment findings, interventions, and patient response. Use objective observations and protect patient privacy. Ask the receiving team whether they need clarification.",
    visibility: "class",
    rights: "original",
    class_id: "demo-class",
  },
  {
    id: "demo-history",
    owner_id: "demo",
    title: "History-taking field notes",
    topic: "Patient assessment",
    content:
      "Original sample study notes. SAMPLE is a memory aid for signs and symptoms, allergies, medications, pertinent past medical history, last oral intake, and events leading up to the illness or injury. It supports history-taking and does not replace assessment of immediate life threats.",
    visibility: "class",
    rights: "original",
    class_id: "demo-class",
  },
];
export const demoSet: StudySet = {
  id: "demo-set",
  title: "Patient assessment essentials",
  topic: "Patient assessment",
  resourceId: "demo-assessment",
  groundingVersion: 1,
  cards: [
    {
      front: "What is the purpose of scene size-up?",
      back: "Identify scene hazards, protective equipment needs, the nature of the incident, patient count, and additional resources.",
      source: "Patient assessment essentials",
      evidence:
        "Scene size-up includes scene safety, appropriate protective equipment, mechanism of injury or nature of illness, number of patients, and need for additional resources.",
    },
    {
      front: "What does the primary assessment prioritize?",
      back: "Identifying immediate life threats.",
      source: "Patient assessment essentials",
      evidence: "The primary assessment identifies immediate life threats.",
    },
    {
      front: "Why reassess a patient?",
      back: "To identify changes in their condition and their response to interventions.",
      source: "Patient assessment essentials",
      evidence:
        "Reassessment looks for changes in the patient and response to interventions.",
    },
  ],
  questions: [
    {
      kind: "terminology",
      question: "What is the main purpose of the primary assessment?",
      options: [
        "Complete a detailed past history",
        "Identify immediate life threats",
        "Write the final report",
        "Determine insurance coverage",
      ],
      answer: 1,
      explanation:
        "The notes define the primary assessment as identifying immediate life threats.",
      source: "Patient assessment essentials",
      evidence: "The primary assessment identifies immediate life threats.",
    },
    {
      kind: "scenario",
      question:
        "You arrive at a training scene with several patients. Which information should you identify during scene size-up?",
      options: [
        "Hospital billing details",
        "The final diagnosis",
        "Scene hazards and patient count",
        "Long-term follow-up appointments",
      ],
      answer: 2,
      explanation:
        "Scene safety and the number of patients help guide the initial response.",
      source: "Patient assessment essentials",
      evidence:
        "Scene size-up includes scene safety, appropriate protective equipment, mechanism of injury or nature of illness, number of patients, and need for additional resources.",
    },
    {
      kind: "scenario",
      question:
        "During a simulated call, your partner asks why you are reassessing after an intervention. What is the best explanation?",
      options: [
        "Changes and response to interventions",
        "Only the original complaint",
        "The definitive diagnosis",
        "The patient’s insurance status",
      ],
      answer: 0,
      explanation:
        "Reassessment tracks how the condition and response to interventions change.",
      source: "Patient assessment essentials",
      evidence:
        "Reassessment looks for changes in the patient and response to interventions.",
    },
  ],
};
export const initialProgress: Progress = {
  sets: [demoSet],
  mastered: [],
  attempts: [],
  messages: [],
};
