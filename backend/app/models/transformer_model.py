"""
🤖 Transformer Model for Football Predictions

This module implements a Transformer-based neural network for match predictions,
using self-attention mechanisms to capture complex relationships between features.

Transformers are revolutionary because they can:
- Process all inputs simultaneously (not sequentially like LSTM)
- Learn which features to pay attention to
- Capture long-range dependencies efficiently
- Handle complex feature interactions
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
import math
import logging
from sklearn.preprocessing import StandardScaler
from pathlib import Path

logger = logging.getLogger(__name__)


class PositionalEncoding(nn.Module):
    """
    Positional encoding for transformer to understand sequence order.
    """
    
    def __init__(self, d_model: int, max_len: int = 5000):
        super(PositionalEncoding, self).__init__()
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * 
                           (-math.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        
        pe = pe.unsqueeze(0).transpose(0, 1)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:x.size(0), :]


class FootballTransformer(nn.Module):
    """
    Transformer architecture for football match prediction.
    
    Uses multi-head self-attention to learn complex feature relationships
    and make accurate predictions.
    """
    
    def __init__(self,
                 input_size: int = 150,
                 d_model: int = 512,
                 nhead: int = 8,
                 num_encoder_layers: int = 6,
                 num_decoder_layers: int = 6,
                 dim_feedforward: int = 2048,
                 dropout: float = 0.1,
                 max_seq_length: int = 100):
        """
        Initialize Transformer model.
        
        Args:
            input_size: Number of input features
            d_model: Dimension of model (must be divisible by nhead)
            nhead: Number of attention heads
            num_encoder_layers: Number of encoder layers
            num_decoder_layers: Number of decoder layers
            dim_feedforward: Dimension of feedforward network
            dropout: Dropout rate
            max_seq_length: Maximum sequence length
        """
        super(FootballTransformer, self).__init__()
        
        self.input_size = input_size
        self.d_model = d_model
        
        # Input embedding
        self.input_embedding = nn.Linear(input_size, d_model)
        
        # Positional encoding
        self.pos_encoder = PositionalEncoding(d_model, max_seq_length)
        
        # Transformer encoder
        encoder_layers = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            activation='gelu',  # GELU activation for better performance
            batch_first=True
        )
        
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layers,
            num_layers=num_encoder_layers,
            norm=nn.LayerNorm(d_model)
        )
        
        # Feature-wise attention
        self.feature_attention = nn.MultiheadAttention(
            embed_dim=d_model,
            num_heads=nhead,
            dropout=dropout,
            batch_first=True
        )
        
        # Prediction head
        self.fc1 = nn.Linear(d_model, 256)
        self.fc2 = nn.Linear(256, 128)
        self.fc3 = nn.Linear(128, 64)
        self.output = nn.Linear(64, 3)  # 3 classes: Home, Draw, Away
        
        # Activation and regularization
        self.gelu = nn.GELU()
        self.dropout = nn.Dropout(dropout)
        self.layer_norm1 = nn.LayerNorm(256)
        self.layer_norm2 = nn.LayerNorm(128)
        self.softmax = nn.Softmax(dim=-1)
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize weights using Xavier initialization."""
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)
    
    def create_padding_mask(self, x: torch.Tensor, lengths: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Create padding mask for variable length sequences.
        
        Args:
            x: Input tensor
            lengths: Actual lengths of sequences
            
        Returns:
            Padding mask
        """
        if lengths is None:
            return None
        
        batch_size, max_len = x.size(0), x.size(1)
        mask = torch.arange(max_len, device=x.device).expand(
            batch_size, max_len
        ) >= lengths.unsqueeze(1)
        
        return mask
    
    def forward(self, x: torch.Tensor, 
                mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Forward pass through the transformer.
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
            mask: Optional attention mask
            
        Returns:
            Output probabilities for [Home, Draw, Away]
        """
        # Input embedding
        x = self.input_embedding(x)
        x = self.dropout(x)
        
        # Add positional encoding
        x = x.transpose(0, 1)  # (seq_len, batch, d_model)
        x = self.pos_encoder(x)
        x = x.transpose(0, 1)  # (batch, seq_len, d_model)
        
        # Transformer encoder
        encoded = self.transformer_encoder(x, src_key_padding_mask=mask)
        
        # Apply feature-wise attention
        attn_output, attn_weights = self.feature_attention(
            encoded, encoded, encoded,
            key_padding_mask=mask
        )
        
        # Global pooling (mean over sequence)
        if mask is not None:
            # Masked mean
            mask_expanded = (~mask).unsqueeze(-1).float()
            pooled = (attn_output * mask_expanded).sum(dim=1) / mask_expanded.sum(dim=1)
        else:
            pooled = attn_output.mean(dim=1)
        
        # Prediction head with residual connections
        x = self.dropout(self.gelu(self.fc1(pooled)))
        x = self.layer_norm1(x)
        
        x = self.dropout(self.gelu(self.fc2(x)))
        x = self.layer_norm2(x)
        
        x = self.dropout(self.gelu(self.fc3(x)))
        
        # Output layer
        logits = self.output(x)
        probabilities = self.softmax(logits)
        
        return probabilities
    
    def get_attention_weights(self, x: torch.Tensor) -> torch.Tensor:
        """
        Get attention weights for interpretability.
        
        Args:
            x: Input tensor
            
        Returns:
            Attention weights
        """
        with torch.no_grad():
            x = self.input_embedding(x)
            x = x.transpose(0, 1)
            x = self.pos_encoder(x)
            x = x.transpose(0, 1)
            
            encoded = self.transformer_encoder(x)
            _, attn_weights = self.feature_attention(
                encoded, encoded, encoded
            )
            
        return attn_weights


class TransformerPredictor:
    """
    Transformer-based prediction system for football matches.
    
    This class provides:
    - Advanced attention-based predictions
    - Feature importance through attention weights
    - Ensemble capabilities with other models
    - Interpretable predictions
    """
    
    def __init__(self,
                 sequence_length: int = 10,
                 model_path: Optional[str] = None,
                 device: Optional[str] = None):
        """
        Initialize Transformer predictor.
        
        Args:
            sequence_length: Number of matches to consider
            model_path: Path to pre-trained model
            device: Device to run on
        """
        self.sequence_length = sequence_length
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = None
        self.training_history = []
        
        logger.info(f"Transformer using device: {self.device}")
        
        if model_path and Path(model_path).exists():
            self.load_model(model_path)
    
    def prepare_data(self,
                    features: pd.DataFrame,
                    labels: Optional[pd.Series] = None) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        """
        Prepare data for transformer.
        
        Args:
            features: Feature DataFrame
            labels: Labels (optional)
            
        Returns:
            Prepared tensors
        """
        # Normalize features
        features_scaled = self.scaler.fit_transform(features)
        
        # Create sequences
        sequences = []
        sequence_labels = []
        
        for i in range(len(features_scaled) - self.sequence_length):
            seq = features_scaled[i:i + self.sequence_length]
            sequences.append(seq)
            
            if labels is not None:
                sequence_labels.append(labels.iloc[i + self.sequence_length])
        
        X = torch.FloatTensor(np.array(sequences))
        y = torch.LongTensor(sequence_labels) if labels is not None else None
        
        return X, y
    
    def train(self,
              X_train: pd.DataFrame,
              y_train: pd.Series,
              X_val: Optional[pd.DataFrame] = None,
              y_val: Optional[pd.Series] = None,
              epochs: int = 50,
              batch_size: int = 16,
              learning_rate: float = 0.0001,
              warmup_steps: int = 500) -> Dict[str, Any]:
        """
        Train the Transformer model.
        
        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            epochs: Number of epochs
            batch_size: Batch size
            learning_rate: Initial learning rate
            warmup_steps: Warmup steps for learning rate
            
        Returns:
            Training metrics
        """
        logger.info(f"Training Transformer with {len(X_train)} samples")
        
        # Store feature names
        self.feature_names = list(X_train.columns)
        
        # Prepare data
        X_train_seq, y_train_seq = self.prepare_data(X_train, y_train)
        
        # Create data loader
        train_dataset = TensorDataset(X_train_seq, y_train_seq)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        
        # Initialize model
        input_size = X_train.shape[1]
        self.model = FootballTransformer(input_size=input_size).to(self.device)
        
        # Loss and optimizer
        criterion = nn.CrossEntropyLoss(label_smoothing=0.1)  # Label smoothing for better generalization
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=0.01)
        
        # Learning rate scheduler with warmup
        def lr_lambda(step):
            if step < warmup_steps:
                return step / warmup_steps
            return 1.0
        
        scheduler = optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
        
        # Training loop
        best_val_accuracy = 0.0
        step = 0
        
        for epoch in range(epochs):
            # Training phase
            self.model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0
            
            for batch_X, batch_y in train_loader:
                batch_X = batch_X.to(self.device)
                batch_y = batch_y.to(self.device)
                
                # Forward pass
                optimizer.zero_grad()
                outputs = self.model(batch_X)
                loss = criterion(outputs, batch_y)
                
                # Backward pass
                loss.backward()
                
                # Gradient clipping
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                
                optimizer.step()
                scheduler.step()
                step += 1
                
                # Statistics
                train_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                train_total += batch_y.size(0)
                train_correct += (predicted == batch_y).sum().item()
            
            # Calculate metrics
            avg_train_loss = train_loss / len(train_loader)
            train_accuracy = train_correct / train_total
            
            # Validation phase
            if X_val is not None and y_val is not None:
                self.model.eval()
                X_val_seq, y_val_seq = self.prepare_data(X_val, y_val)
                
                with torch.no_grad():
                    X_val_tensor = X_val_seq.to(self.device)
                    y_val_tensor = y_val_seq.to(self.device)
                    
                    val_outputs = self.model(X_val_tensor)
                    val_loss = criterion(val_outputs, y_val_tensor).item()
                    
                    _, val_predicted = torch.max(val_outputs.data, 1)
                    val_accuracy = (val_predicted == y_val_tensor).sum().item() / len(y_val_tensor)
                
                # Save best model
                if val_accuracy > best_val_accuracy:
                    best_val_accuracy = val_accuracy
                    self.best_model_state = self.model.state_dict().copy()
            
            # Log progress
            if epoch % 5 == 0:
                logger.info(
                    f"Epoch {epoch}/{epochs} - "
                    f"Train Loss: {avg_train_loss:.4f}, "
                    f"Train Acc: {train_accuracy:.4f}, "
                    f"Val Acc: {val_accuracy:.4f}"
                )
            
            # Store history
            self.training_history.append({
                'epoch': epoch,
                'train_loss': avg_train_loss,
                'train_accuracy': train_accuracy,
                'val_accuracy': val_accuracy if X_val is not None else None
            })
        
        # Load best model
        if hasattr(self, 'best_model_state'):
            self.model.load_state_dict(self.best_model_state)
        
        logger.info(f"Training complete! Best validation accuracy: {best_val_accuracy:.4f}")
        
        return {
            'best_val_accuracy': best_val_accuracy,
            'final_train_accuracy': train_accuracy,
            'training_history': self.training_history
        }
    
    def predict(self,
                features: pd.DataFrame,
                return_attention: bool = False) -> Dict[str, Any]:
        """
        Make predictions using the Transformer.
        
        Args:
            features: Features for prediction
            return_attention: Whether to return attention weights
            
        Returns:
            Predictions and probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained!")
        
        self.model.eval()
        
        # Prepare data
        X_seq, _ = self.prepare_data(features)
        
        with torch.no_grad():
            X_tensor = X_seq.to(self.device)
            outputs = self.model(X_tensor)
            probabilities = outputs.cpu().numpy()
        
        # Get predictions
        predictions = np.argmax(probabilities, axis=1)
        
        results = {
            'predictions': predictions,
            'probabilities': probabilities,
            'confidence': np.max(probabilities, axis=1)
        }
        
        # Get attention weights if requested
        if return_attention:
            attention_weights = self.model.get_attention_weights(X_tensor)
            results['attention_weights'] = attention_weights.cpu().numpy()
        
        return results
    
    def predict_single_match(self,
                           home_team: str,
                           away_team: str,
                           recent_features: pd.DataFrame,
                           explain: bool = True) -> Dict[str, Any]:
        """
        Predict a single match with explanation.
        
        Args:
            home_team: Home team
            away_team: Away team
            recent_features: Recent match features
            explain: Whether to include attention-based explanation
            
        Returns:
            Detailed prediction
        """
        # Make prediction
        results = self.predict(recent_features, return_attention=explain)
        
        # Extract probabilities
        probs = results['probabilities'][-1]
        
        output = {
            'home_team': home_team,
            'away_team': away_team,
            'home_win': float(probs[0]),
            'draw': float(probs[1]),
            'away_win': float(probs[2]),
            'predicted_outcome': ['Home', 'Draw', 'Away'][results['predictions'][-1]],
            'confidence': float(results['confidence'][-1]),
            'model_type': 'Transformer Neural Network',
            'summary': (
                f"{home_team} vs {away_team}: "
                f"{home_team} {probs[0]:.1%} | "
                f"Draw {probs[1]:.1%} | "
                f"{away_team} {probs[2]:.1%}"
            )
        }
        
        # Add attention-based explanation
        if explain and 'attention_weights' in results:
            attention = results['attention_weights'][-1]
            
            # Find most attended features
            feature_attention = attention.mean(axis=0).mean(axis=0)
            top_features_idx = np.argsort(feature_attention)[-10:]
            
            output['key_factors'] = [
                {
                    'feature': self.feature_names[idx],
                    'attention_score': float(feature_attention[idx])
                }
                for idx in top_features_idx
            ]
            
            output['explanation'] = (
                f"Model focused most on: {self.feature_names[top_features_idx[-1]]}"
            )
        
        return output
    
    def ensemble_predict(self,
                        features: pd.DataFrame,
                        other_predictions: List[Dict[str, float]],
                        weights: Optional[List[float]] = None) -> Dict[str, Any]:
        """
        Ensemble prediction combining Transformer with other models.
        
        Args:
            features: Input features
            other_predictions: Predictions from other models
            weights: Model weights for ensemble
            
        Returns:
            Ensemble prediction
        """
        # Get transformer prediction
        transformer_pred = self.predict(features)
        transformer_probs = transformer_pred['probabilities'][-1]
        
        # Combine predictions
        all_predictions = [transformer_probs] + [
            [p['home_win'], p['draw'], p['away_win']] 
            for p in other_predictions
        ]
        
        if weights is None:
            weights = [1.0 / len(all_predictions)] * len(all_predictions)
        
        # Weighted average
        ensemble_probs = np.average(all_predictions, axis=0, weights=weights)
        
        # Normalize
        ensemble_probs = ensemble_probs / ensemble_probs.sum()
        
        return {
            'home_win': float(ensemble_probs[0]),
            'draw': float(ensemble_probs[1]),
            'away_win': float(ensemble_probs[2]),
            'predicted_outcome': ['Home', 'Draw', 'Away'][np.argmax(ensemble_probs)],
            'confidence': float(np.max(ensemble_probs)),
            'model_type': 'Ensemble (Transformer + Others)',
            'models_combined': len(all_predictions)
        }
    
    def save_model(self, path: str):
        """Save the trained model."""
        if self.model is None:
            raise ValueError("No model to save!")
        
        save_dict = {
            'model_state': self.model.state_dict(),
            'model_config': {
                'input_size': self.model.input_size,
                'd_model': self.model.d_model
            },
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'sequence_length': self.sequence_length,
            'training_history': self.training_history
        }
        
        torch.save(save_dict, path)
        logger.info(f"Transformer model saved to {path}")
    
    def load_model(self, path: str):
        """Load a trained model."""
        save_dict = torch.load(path, map_location=self.device)
        
        # Recreate model
        config = save_dict['model_config']
        self.model = FootballTransformer(
            input_size=config['input_size'],
            d_model=config['d_model']
        ).to(self.device)
        
        # Load weights
        self.model.load_state_dict(save_dict['model_state'])
        
        # Load other components
        self.scaler = save_dict['scaler']
        self.feature_names = save_dict['feature_names']
        self.sequence_length = save_dict['sequence_length']
        self.training_history = save_dict.get('training_history', [])
        
        logger.info(f"Transformer model loaded from {path}")


# Example usage
if __name__ == "__main__":
    print("🤖 Transformer Football Predictor Demo\n")
    print("=" * 50)
    
    # Architecture details
    print("📊 Model Architecture:")
    print("  • Self-Attention Mechanism")
    print("  • 8 Attention Heads")
    print("  • 6 Encoder Layers")
    print("  • Positional Encoding")
    print("  • GELU Activation")
    print("  • Layer Normalization")
    print("  • Label Smoothing")
    
    print("\n🎯 Key Advantages:")
    print("  • Captures complex feature relationships")
    print("  • Parallel processing (faster than LSTM)")
    print("  • Interpretable through attention weights")
    print("  • State-of-the-art performance")
    print("  • Handles long-range dependencies")
    
    print("\n⚡ Advanced Features:")
    print("  • Attention visualization for explainability")
    print("  • Ensemble capabilities")
    print("  • Feature importance through attention")
    print("  • Confidence and uncertainty estimates")
    
    print("\n✅ Transformer Predictor Ready!")
    print("\nNext steps:")
    print("1. Load match sequences")
    print("2. Train with attention mechanisms")
    print("3. Visualize what the model focuses on!")
    print("4. Combine with LSTM and XGBoost for ensemble!")