import sys
import os
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import numpy as np

# Define the 14 diseases the model can detect
DISEASES = [
    'Atelectasis',
    'Cardiomegaly', 
    'Effusion',
    'Infiltration',
    'Mass',
    'Nodule',
    'Pneumonia',
    'Pneumothorax',
    'Consolidation',
    'Edema',
    'Emphysema',
    'Fibrosis',
    'Pleural_Thickening',
    'Hernia'
]

def analyze_chest_xray(image_path):
    try:
        # Get the absolute path to the model
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, 'final_chest_disease_model.h5')
        
        # Load the model
        try:
            custom_objects = {'BatchNormalization': tf.keras.layers.BatchNormalization}
            model = load_model(model_path, compile=False, custom_objects=custom_objects)
        except Exception as model_error:
            if 'batch_shape' in str(model_error):
                model = tf.keras.models.load_model(model_path, compile=False)
            else:
                raise model_error
        
        # Load and preprocess X-ray image
        img = image.load_img(image_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0  # normalize

        # Predict with error handling
        predictions = model.predict(img_array, verbose=0)
        
        # Process predictions for all 14 diseases
        result_lines = []
        for i, disease in enumerate(DISEASES):
            confidence = predictions[0][i]
            confidence_percentage = int(confidence * 100)
            status = 'Detected' if confidence > 0.5 else 'Not Detected'
            result_lines.append(f"{disease}: {status} ({confidence_percentage}%)")
        
        # Format the result
        return '\n'.join(result_lines)
        
    except Exception as e:
        # Fallback analysis
        try:
            import h5py
            from tensorflow.keras.models import model_from_json
            
            # Extract architecture and weights separately
            h5_file = h5py.File(os.path.join(script_dir, 'final_chest_disease_model.h5'), 'r')
            model_json = h5_file.attrs.get('model_config')
            if model_json is None:
                return f"Error: Could not extract model architecture from H5 file"
                
            # Convert from bytes to string if needed
            if isinstance(model_json, bytes):
                model_json = model_json.decode('utf-8')
                
            # Create model from JSON
            model = model_from_json(model_json)
            
            # Load weights
            weight_names = [name for name in h5_file['model_weights'].attrs['weight_names']]
            for weight_name in weight_names:
                weight = h5_file['model_weights'][weight_name]
                model.set_weights([weight])
            
            h5_file.close()
            
            # Process image
            img = image.load_img(image_path, target_size=(224, 224))
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0) / 255.0
            
            # Make prediction
            predictions = model.predict(img_array)
            
            # Process predictions
            result_lines = []
            for i, disease in enumerate(DISEASES):
                confidence = predictions[0][i]
                confidence_percentage = int(confidence * 100)
                status = 'Detected' if confidence > 0.5 else 'Not Detected'
                result_lines.append(f"{disease}: {status} ({confidence_percentage}%)")
            
            return '\n'.join(result_lines)
                
        except Exception as final_error:
            import traceback
            error_details = traceback.format_exc()
            return f"Analysis Error: {str(final_error)}"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if os.path.exists(image_path):
            result = analyze_chest_xray(image_path)
            print(result)
        else:
            print(f"Error: Image file not found at {image_path}")
    else:
        print("No image path provided") 