import { Router } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import { Note, NOTE_KINDS, type NoteAttrs } from '../models/Note.ts';
import { AppError } from '../lib/errors.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';

export const notesRouter = Router();
notesRouter.use(requireAuth);

const stringList = z.array(z.string().trim().max(500)).max(50);

const noteBody = z.object({
  kind: z.enum(NOTE_KINDS).optional(),
  title: z.string().trim().min(1, 'Give your note a title.').max(140),
  coreIdea: z.string().max(2000).optional(),
  explanation: z.string().max(20000).optional(),
  checklist: stringList.optional(),
  pitfalls: stringList.optional(),
  codeSnippet: z.string().max(20000).optional(),
  codeLanguage: z.string().trim().max(20).optional(),
  whatWentWrong: z.string().max(5000).optional(),
  whyItFailed: z.string().max(5000).optional(),
  whatILearned: z.string().max(5000).optional(),
  rememberNextTime: z.string().max(5000).optional(),
  conceptSlugs: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  problemKeys: z.array(z.string().regex(/^codeforces:[A-Za-z0-9]+$/)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(NOTE_KINDS).optional(),
  concept: z.string().trim().max(60).optional(),
  problem: z.string().trim().max(60).optional(),
  tag: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid note id.') });

function serialize(n: NoteAttrs & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date }) {
  return {
    id: n._id.toString(),
    kind: n.kind,
    title: n.title,
    coreIdea: n.coreIdea,
    explanation: n.explanation,
    checklist: n.checklist,
    pitfalls: n.pitfalls,
    codeSnippet: n.codeSnippet,
    codeLanguage: n.codeLanguage,
    whatWentWrong: n.whatWentWrong,
    whyItFailed: n.whyItFailed,
    whatILearned: n.whatILearned,
    rememberNextTime: n.rememberNextTime,
    conceptSlugs: n.conceptSlugs,
    problemKeys: n.problemKeys,
    tags: n.tags,
    pinned: n.pinned,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

notesRouter.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = getValidated<z.infer<typeof listQuery>>(req);
    const filter: FilterQuery<NoteAttrs> = { userId: new Types.ObjectId(req.user!.id) };
    if (q.kind) filter.kind = q.kind;
    if (q.concept) filter.conceptSlugs = q.concept;
    if (q.problem) filter.problemKeys = q.problem;
    if (q.tag) filter.tags = q.tag;
    if (q.q) {
      const escaped = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: escaped, $options: 'i' };
      filter.$or = [{ title: rx }, { coreIdea: rx }, { explanation: rx }, { whatILearned: rx }, { tags: rx }];
    }
    const [total, docs] = await Promise.all([
      Note.countDocuments(filter),
      Note.find(filter)
        .sort({ pinned: -1, updatedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
    ]);
    res.json({ total, notes: docs.map((d) => serialize(d)) });
  }),
);

notesRouter.post(
  '/',
  validate(noteBody),
  asyncHandler(async (req, res) => {
    const body = getValidated<z.infer<typeof noteBody>>(req);
    const note = await Note.create({ ...body, userId: new Types.ObjectId(req.user!.id) });
    res.status(201).json({ note: serialize(note.toObject()) });
  }),
);

/** Ownership is enforced by including userId in every query — never by id alone. */
notesRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = getValidated<z.infer<typeof idParam>>(req);
    const note = await Note.findOne({ _id: id, userId: new Types.ObjectId(req.user!.id) }).lean();
    if (!note) throw AppError.notFound('Note not found.');
    res.json({ note: serialize(note) });
  }),
);

notesRouter.put(
  '/:id',
  validate(idParam, 'params'),
  validate(noteBody.partial()),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = getValidated<Partial<z.infer<typeof noteBody>>>(req);
    const note = await Note.findOneAndUpdate({ _id: id, userId: new Types.ObjectId(req.user!.id) }, { $set: body }, { new: true }).lean();
    if (!note) throw AppError.notFound('Note not found.');
    res.json({ note: serialize(note) });
  }),
);

notesRouter.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = getValidated<z.infer<typeof idParam>>(req);
    const result = await Note.deleteOne({ _id: id, userId: new Types.ObjectId(req.user!.id) });
    if (result.deletedCount === 0) throw AppError.notFound('Note not found.');
    res.status(204).end();
  }),
);
