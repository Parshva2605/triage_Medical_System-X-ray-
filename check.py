import os
import re
import glob
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import VGG19
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
import tensorflow as tf

# ✅ Enable GPU memory growth
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    for gpu in physical_devices:
        tf.config.experimental.set_memory_growth(gpu, True)
    print("✅ GPU Enabled")
else:
    print("⚠️ GPU not detected. Using CPU.")

# ✅ Disease labels
disease_labels = [
    'Atelectasis', 'Cardiomegaly', 'Effusion', 'Infiltration', 'Mass',
    'Nodule', 'Pneumonia', 'Pneumothorax', 'Consolidation', 'Edema',
    'Emphysema', 'Fibrosis', 'Pleural_Thickening', 'Hernia'
]

# ✅ Paths
BASE_DIR = Path("C:/Users/91851/Desktop/parul uni. Hackthon/Aio/aio-dataset")
CSV_PATH = BASE_DIR / "Data_Entry_2017.csv"
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 20

# ✅ Load CSV and prepare labels
df = pd.read_csv(CSV_PATH)
for disease in disease_labels:
    df[disease] = df['Finding Labels'].apply(lambda x: 1 if disease in x else 0)

# ✅ Resolve image paths
def resolve_path(image_name):
    for i in range(1, 13):
        path = BASE_DIR / f"images_{i:03d}/images/{image_name}"
        if os.path.exists(path):
            return str(path)
    return None

df['Image Path'] = df['Image Index'].apply(resolve_path)
df = df[df['Image Path'].notna()]
print(f"✅ Total valid images: {len(df)}")

# ✅ Train-validation split
train_df, val_df = train_test_split(df, test_size=0.2, random_state=42)

# ✅ Data generators
datagen_train = ImageDataGenerator(rescale=1./255, rotation_range=10, zoom_range=0.1, horizontal_flip=True)
datagen_val = ImageDataGenerator(rescale=1./255)

train_gen = datagen_train.flow_from_dataframe(
    train_df, x_col='Image Path', y_col=disease_labels,
    target_size=IMG_SIZE, class_mode='raw', batch_size=BATCH_SIZE, shuffle=True
)

val_gen = datagen_val.flow_from_dataframe(
    val_df, x_col='Image Path', y_col=disease_labels,
    target_size=IMG_SIZE, class_mode='raw', batch_size=BATCH_SIZE, shuffle=False
)

# ✅ Auto Resume Setup
checkpoint_files = glob.glob("checkpoint_epoch_*.h5")
latest_epoch = 0
latest_checkpoint = None

if checkpoint_files:
    checkpoint_files.sort(key=lambda x: int(re.findall(r'checkpoint_epoch_(\d+).h5', x)[0]))
    latest_checkpoint = checkpoint_files[-1]
    latest_epoch = int(re.findall(r'checkpoint_epoch_(\d+).h5', latest_checkpoint)[0])
    print(f"🔁 Resuming from {latest_checkpoint} (epoch {latest_epoch})")
    model = load_model(latest_checkpoint)
else:
    print("🆕 Starting training from scratch...")
    base_model = VGG19(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    for layer in base_model.layers[:-6]:
        layer.trainable = False
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(1024, activation='relu')(x)
    x = Dropout(0.4)(x)
    predictions = Dense(len(disease_labels), activation='sigmoid')(x)
    model = Model(inputs=base_model.input, outputs=predictions)
    model.compile(optimizer=Adam(1e-4), loss='binary_crossentropy', metrics=['accuracy'])

# ✅ Callbacks (checkpoint every epoch + early stopping)
callbacks = [
    EarlyStopping(patience=4, restore_best_weights=True, monitor='val_loss'),
    ModelCheckpoint(
        filepath='checkpoint_epoch_{epoch:02d}.h5',
        save_weights_only=False,
        save_best_only=False,
        monitor='val_loss',
        verbose=1
    ),
    ModelCheckpoint(
        filepath='best_chest_model.h5',
        save_weights_only=False,
        save_best_only=True,
        monitor='val_loss',
        verbose=1
    )
]

# ✅ Start / Resume Training
history = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS,
    initial_epoch=latest_epoch,
    steps_per_epoch=len(train_gen),
    validation_steps=len(val_gen),
    callbacks=callbacks
)

# ✅ Save Final Model
model.save("final_chest_disease_model.h5")
print("✅ Training complete and final model saved.")
