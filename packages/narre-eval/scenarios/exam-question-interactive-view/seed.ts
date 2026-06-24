import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const world = await ctx.createWorld({
    name: 'Interactive View Exam Fixture',
    root_dir: ctx.tempDir,
  });
  await ctx.createModule({
    root_network_id: world.id,
    name: 'Ontology',
    path: ctx.tempDir,
  });

  const schema = await ctx.createSchema({
    root_network_id: world.id,
    name: 'Exam Question',
    description: 'A question with choices, answer, and explanation fields.',
    icon: 'circle-help',
    color: '#2563eb',
  });

  const questionField = await ctx.createSchemaField({
    schema_id: schema.id,
    name: 'question',
    field_type: 'textarea',
    sort_order: 0,
    required: true,
    source_kind: 'world',
    source_ref: 'exam.question.question',
  });
  const choicesField = await ctx.createSchemaField({
    schema_id: schema.id,
    name: 'choices',
    field_type: 'textarea',
    sort_order: 1,
    required: true,
    source_kind: 'world',
    source_ref: 'exam.question.choices',
  });
  const answerField = await ctx.createSchemaField({
    schema_id: schema.id,
    name: 'answer',
    field_type: 'text',
    sort_order: 2,
    required: true,
    source_kind: 'world',
    source_ref: 'exam.question.answer',
  });
  const explanationField = await ctx.createSchemaField({
    schema_id: schema.id,
    name: 'explanation',
    field_type: 'textarea',
    sort_order: 3,
    required: false,
    source_kind: 'world',
    source_ref: 'exam.question.explanation',
  });

  const instance = await ctx.createInstance({
    root_network_id: world.id,
    schema_id: schema.id,
    title: 'Photosynthesis Multiple Choice',
    content: 'Use the interactive view to answer the question.',
  });

  await ctx.upsertInstanceProperty({
    instance_id: instance.id,
    field_id: questionField.id,
    value: 'Which organelle performs photosynthesis in plant cells?',
  });
  await ctx.upsertInstanceProperty({
    instance_id: instance.id,
    field_id: choicesField.id,
    value: JSON.stringify(['Mitochondrion', 'Chloroplast', 'Ribosome', 'Golgi apparatus']),
  });
  await ctx.upsertInstanceProperty({
    instance_id: instance.id,
    field_id: answerField.id,
    value: 'Chloroplast',
  });
  await ctx.upsertInstanceProperty({
    instance_id: instance.id,
    field_id: explanationField.id,
    value: 'Chloroplasts contain chlorophyll and convert light energy into chemical energy.',
  });

  ctx.setTemplateVars({
    root_network_id: world.id,
    schema_id: schema.id,
    question_instance_id: instance.id,
    question_instance_title: instance.title,
    question_field_id: questionField.id,
    choices_field_id: choicesField.id,
    answer_field_id: answerField.id,
    explanation_field_id: explanationField.id,
  });
}
