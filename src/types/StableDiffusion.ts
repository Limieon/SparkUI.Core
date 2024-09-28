export enum ModelType {
	Checkpoint,
	Lora,
	Embedding,
	ControlNet,
	Other,
}

export enum ControlNetType {
	Blur,
	Canny,
	Depth,
	IPAdapter,
	Inpaint,
	InstantID,
	Lineart,
	MLSD,
	NormalMap,
	OpenPose,
	Recolor,
	Reference,
	Revision,
	Scribble,
	Segmentation,
	Shuffle,
	Sketch,
	SoftEdge,
	T2IAdapter,
	Tile,
}

export enum Precision {
	FP16,
	FP32,
	BF16,
}

export enum SizeType {
	Full,
	Pruned,
	Unknown,
}
