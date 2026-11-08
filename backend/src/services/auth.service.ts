import argon2 from "argon2";
import { prisma } from "../lib/prisma.js";

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

export const registerUser = async (input: RegisterInput) => {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.create({
    data: {
      displayName: input.displayName,
      email: input.email,
      passwordHash: passwordHash,
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
    },
  });

  return user;
};


export const verifyLogin = async (
  email: string,
  password: string
) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    return null;
  }

  const passwordIsValid = await argon2.verify(
    user.passwordHash,
    password
  );

  if (!passwordIsValid) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    createdAt: user.createdAt,
  };
};


export const findUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
    },
  });
};
