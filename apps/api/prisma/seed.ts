// // apps/api/prisma/seed.ts
// import { PrismaClient, MemberRole } from "@prisma/client";
// import bcrypt from "bcrypt";

// const prisma = new PrismaClient();

// async function main() {
//   console.log("🌱 Seeding database…");

// //   // Wipe in FK-safe order
// //   await prisma.$transaction([
// //     prisma.projectMember.deleteMany(),
// //     prisma.submission.deleteMany(),
// //     prisma.project.deleteMany(),
// //     prisma.user.deleteMany(),
// //   ]);

//   // Simple shared password
//   const passwordHash = await bcrypt.hash("password", 10);

//   // Users
//   const [alice, matt, bob] = await Promise.all([
//     prisma.user.create({
//       data: { email: "alice@email.com", passwordHash, name: "Alice" },
//     }),
//     prisma.user.create({
//       data: { email: "matt@email.com", passwordHash, name: "Matt" },
//     }),
//     prisma.user.create({
//       data: { email: "bob@email.com", passwordHash, name: "Bob" },
//     }),
//   ]);

//   // Project #1: owned by Alice, members: Alice(OWNER), Matt(REVIEWER)
//   const collproj = await prisma.project.create({
//     data: {
//       name: "collproj",
//       description: "Example collaboration project",
//       ownerId: alice.id,
//       // members: {
//       //   // create: [
//       //   //   { userId: alice.id, role: MemberRole.OWNER },
//       //   //   { userId: matt.id, role: MemberRole.REVIEWER },
//       //   // ],
//       // },
//     },
//     include: { members: true },
//   });

//   // Project #2: owned by Matt, members: Matt(OWNER), Alice(MAINTAINER), Bob(REVIEWER)
//   const reviewHub = await prisma.project.create({
//     data: {
//       name: "review-hub",
//       description: "Peer review sandbox",
//       ownerId: matt.id,
//       members: {
//         create: [
//           { userId: matt.id, role: MemberRole.OWNER },
//           { userId: alice.id, role: MemberRole.MAINTAINER },
//           { userId: bob.id, role: MemberRole.REVIEWER },
//         ],
//       },
//     },
//     include: { members: true },
//   });

//   // Submissions
//   await prisma.submission.create({
//     data: {
//       projectId: collproj.id,
//       authorId: bob.id,
//       title: "example-1",
//       language: "javascript",
//       code: `function greet(name){ return "Hello, " + name }`,
//     },
//   });

//   await prisma.submission.create({
//     data: {
//       projectId: reviewHub.id,
//       authorId: alice.id,
//       title: "array-utils",
//       language: "typescript",
//       code: `export const uniq = <T>(xs: T[]) => Array.from(new Set(xs));`,
//     },
//   });

//   console.log("✅ Seed complete.");
// }

// main()
//   .catch((e) => {
//     console.error("❌ Seed failed:", e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });