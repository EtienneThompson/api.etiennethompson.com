import { Request, Response } from "express";

export const getFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "getFolder endpoint" });
};

export const getItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "getItem endpoint" });
};

export const createFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "createFolder endpoint" });
};

export const createItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "createItem endpoint" });
};

export const updateFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "updateFolder endpoint" });
};

export const updateItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "updateItem endpoint" });
};

export const deleteFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "deleteFolder endpoint" });
};

export const deleteItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "deleteItem endpoint" });
};
