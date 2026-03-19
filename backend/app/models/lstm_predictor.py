"""
🧠 LSTM Neural Network for Football Predictions

This module implements a Long Short-Term Memory (LSTM) neural network for
predicting match outcomes based on sequential data patterns.

LSTMs are perfect for football because they can:
- Remember long-term patterns (e.g., seasonal form)
- Capture momentum and form streaks
- Learn complex temporal dependencies
- Handle variable-length sequences
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import logging
from sklearn.preprocessing import StandardScaler
import joblib
from pathlib import Path

logger = logging.getLogger(__name__)


class FootballLSTM(nn.Module):
    """
    LSTM neural network for match prediction.
    
    Architecture:
    - Multi-layer LSTM with attention mechanism
    - Dropout for regularization
    - Batch normalization for stability
    - Custom output layer for match outcomes
    """
    
    def __init__(self, 
                 input_size: int = 150,
                 hidden_size: int = 256,
                 num_layers: int = 3,
                 dropout: float = 0.3,
                 attention: bool = True):
        """
        Initialize LSTM model.
        
        Args:
            input_size: Number of input features (150+ from feature engineering)
            hidden_size: Size of LSTM hidden state
            num_layers: Number of LSTM layers
            dropout: Dropout rate for regularization
            attention: Whether to use attention mechanism
        """
        super(FootballLSTM, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.use_attention = attention
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True,
            bidirectional=True  # Bidirectional for better context
        )
        
        # Attention mechanism
        if self.use_attention:
            self.attention = nn.MultiheadAttention(
                embed_dim=hidden_size * 2,  # *2 for bidirectional
                num_heads=8,
                dropout=dropout
            )
        
        # Batch normalization
        self.batch_norm = nn.BatchNorm1d(hidden_size * 2)
        
        # Fully connected layers
        self.fc1 = nn.Linear(hidden_size * 2, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 32)
        
        # Output layer (3 classes: Home, Draw, Away)
        self.output = nn.Linear(32, 3)
        
        # Activation and regularization
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.softmax = nn.Softmax(dim=1)
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize weights using Xavier initialization."""
        for name, param in self.named_parameters():
            if 'weight' in name:
                if 'lstm' in name:
                    # LSTM weights need special initialization
                    nn.init.orthogonal_(param)
                else:
                    nn.init.xavier_uniform_(param)
            elif 'bias' in name:
                nn.init.zeros_(param)
    
    def forward(self, x: torch.Tensor, 
                hidden: Optional[Tuple[torch.Tensor, torch.Tensor]] = None) -> torch.Tensor:
        """
        Forward pass through the network.
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
            hidden: Initial hidden state (optional)
            
        Returns:
            Output probabilities for [Home, Draw, Away]
        """
        batch_size = x.size(0)
        
        # LSTM forward pass
        lstm_out, (h_n, c_n) = self.lstm(x, hidden)
        
        # Apply attention if enabled
        if self.use_attention:
            # Reshape for attention (seq_len, batch, features)
            lstm_out = lstm_out.transpose(0, 1)
            attn_out, attn_weights = self.attention(lstm_out, lstm_out, lstm_out)
            # Take the mean over sequence length
            lstm_out = attn_out.mean(dim=0)
        else:
            # Use the last hidden state
            lstm_out = lstm_out[:, -1, :]
        
        # Batch normalization
        lstm_out = self.batch_norm(lstm_out)
        
        # Fully connected layers with dropout
        x = self.dropout(self.relu(self.fc1(lstm_out)))
        x = self.dropout(self.relu(self.fc2(x)))
        x = self.dropout(self.relu(self.fc3(x)))
        
        # Output layer
        output = self.output(x)
        
        # Apply softmax for probabilities
        probabilities = self.softmax(output)
        
        return probabilities


class LSTMPredictor:
    """
    LSTM-based prediction system for football matches.
    
    This class handles:
    - Data preparation and sequencing
    - Model training with early stopping
    - Prediction generation
    - Model persistence
    """
    
    def __init__(self, 
                 sequence_length: int = 10,
                 model_path: Optional[str] = None,
                 device: Optional[str] = None):
        """
        Initialize LSTM predictor.
        
        Args:
            sequence_length: Number of previous matches to consider
            model_path: Path to pre-trained model
            device: Device to run on ('cuda' or 'cpu')
        """
        self.sequence_length = sequence_length
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = None
        self.training_history = []
        
        logger.info(f"Using device: {self.device}")
        
        if model_path and Path(model_path).exists():
            self.load_model(model_path)
    
    def prepare_sequences(self, 
                         features: pd.DataFrame,
                         labels: Optional[pd.Series] = None) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        """
        Prepare sequential data for LSTM.
        
        Args:
            features: Feature DataFrame
            labels: Labels (optional, for training)
            
        Returns:
            Tuple of (sequences, labels) as torch tensors
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
                # Use the label of the next match after the sequence
                sequence_labels.append(labels.iloc[i + self.sequence_length])
        
        # Convert to tensors
        X = torch.FloatTensor(np.array(sequences))
        y = torch.LongTensor(sequence_labels) if labels is not None else None
        
        return X, y
    
    def train(self,
              X_train: pd.DataFrame,
              y_train: pd.Series,
              X_val: Optional[pd.DataFrame] = None,
              y_val: Optional[pd.Series] = None,
              epochs: int = 100,
              batch_size: int = 32,
              learning_rate: float = 0.001,
              early_stopping_patience: int = 10) -> Dict[str, Any]:
        """
        Train the LSTM model.
        
        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            epochs: Number of training epochs
            batch_size: Batch size
            learning_rate: Learning rate
            early_stopping_patience: Patience for early stopping
            
        Returns:
            Training history and metrics
        """
        if len(X_train) == 0:
            raise ValueError("No real training data provided — refusing to train on empty data")

        logger.info(f"Training LSTM with {len(X_train)} samples")

        # Store feature names
        self.feature_names = list(X_train.columns)
        
        # Prepare sequences
        X_train_seq, y_train_seq = self.prepare_sequences(X_train, y_train)
        
        # Create data loader
        train_dataset = TensorDataset(X_train_seq, y_train_seq)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        
        # Initialize model
        input_size = X_train.shape[1]
        self.model = FootballLSTM(input_size=input_size).to(self.device)
        
        # Loss and optimizer
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', factor=0.5, patience=5
        )
        
        # Training loop
        best_val_loss = float('inf')
        patience_counter = 0
        
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
                
                # Gradient clipping to prevent exploding gradients
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                
                optimizer.step()
                
                # Statistics
                train_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                train_total += batch_y.size(0)
                train_correct += (predicted == batch_y).sum().item()
            
            # Calculate epoch metrics
            avg_train_loss = train_loss / len(train_loader)
            train_accuracy = train_correct / train_total
            
            # Validation phase
            val_loss = 0.0
            val_accuracy = 0.0
            
            if X_val is not None and y_val is not None:
                self.model.eval()
                X_val_seq, y_val_seq = self.prepare_sequences(X_val, y_val)
                
                with torch.no_grad():
                    X_val_tensor = X_val_seq.to(self.device)
                    y_val_tensor = y_val_seq.to(self.device)
                    
                    val_outputs = self.model(X_val_tensor)
                    val_loss = criterion(val_outputs, y_val_tensor).item()
                    
                    _, val_predicted = torch.max(val_outputs.data, 1)
                    val_accuracy = (val_predicted == y_val_tensor).sum().item() / len(y_val_tensor)
                
                # Learning rate scheduling
                scheduler.step(val_loss)
                
                # Early stopping
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    patience_counter = 0
                    # Save best model
                    self.best_model_state = self.model.state_dict().copy()
                else:
                    patience_counter += 1
                    if patience_counter >= early_stopping_patience:
                        logger.info(f"Early stopping at epoch {epoch}")
                        break
            
            # Log progress
            if epoch % 10 == 0:
                logger.info(
                    f"Epoch {epoch}/{epochs} - "
                    f"Train Loss: {avg_train_loss:.4f}, "
                    f"Train Acc: {train_accuracy:.4f}, "
                    f"Val Loss: {val_loss:.4f}, "
                    f"Val Acc: {val_accuracy:.4f}"
                )
            
            # Store history
            self.training_history.append({
                'epoch': epoch,
                'train_loss': avg_train_loss,
                'train_accuracy': train_accuracy,
                'val_loss': val_loss,
                'val_accuracy': val_accuracy
            })
        
        # Load best model
        if hasattr(self, 'best_model_state'):
            self.model.load_state_dict(self.best_model_state)
        
        logger.info(f"Training complete! Best validation loss: {best_val_loss:.4f}")
        
        return {
            'best_val_loss': best_val_loss,
            'final_train_accuracy': train_accuracy,
            'final_val_accuracy': val_accuracy,
            'training_history': self.training_history
        }
    
    def predict(self, 
                features: pd.DataFrame,
                return_confidence: bool = True) -> Dict[str, Any]:
        """
        Make predictions using the LSTM model.
        
        Args:
            features: Features for prediction
            return_confidence: Whether to return confidence scores
            
        Returns:
            Predictions and probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained! Call train() first.")
        
        self.model.eval()
        
        # Prepare sequences
        X_seq, _ = self.prepare_sequences(features)
        
        with torch.no_grad():
            X_tensor = X_seq.to(self.device)
            outputs = self.model(X_tensor)
            probabilities = outputs.cpu().numpy()
        
        # Get predictions
        predictions = np.argmax(probabilities, axis=1)
        
        results = {
            'predictions': predictions,
            'probabilities': probabilities
        }
        
        if return_confidence:
            # Calculate confidence as max probability
            confidence = np.max(probabilities, axis=1)
            results['confidence'] = confidence
            
            # Add prediction uncertainty (entropy)
            entropy = -np.sum(probabilities * np.log(probabilities + 1e-10), axis=1)
            results['uncertainty'] = entropy
        
        return results
    
    def predict_single_match(self,
                           home_team: str,
                           away_team: str,
                           recent_features: pd.DataFrame) -> Dict[str, Any]:
        """
        Predict a single match outcome.
        
        Args:
            home_team: Home team name
            away_team: Away team name
            recent_features: Recent match features (sequence_length rows)
            
        Returns:
            Prediction with probabilities and explanation
        """
        if len(recent_features) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} recent matches")
        
        # Make prediction
        results = self.predict(recent_features)
        
        # Extract probabilities for the last prediction
        probs = results['probabilities'][-1]
        
        return {
            'home_team': home_team,
            'away_team': away_team,
            'home_win': float(probs[0]),
            'draw': float(probs[1]),
            'away_win': float(probs[2]),
            'predicted_outcome': ['Home', 'Draw', 'Away'][results['predictions'][-1]],
            'confidence': float(results['confidence'][-1]),
            'uncertainty': float(results['uncertainty'][-1]),
            'model_type': 'LSTM Neural Network',
            'summary': (
                f"{home_team} vs {away_team}: "
                f"{home_team} {probs[0]:.1%} | "
                f"Draw {probs[1]:.1%} | "
                f"{away_team} {probs[2]:.1%}"
            )
        }
    
    def save_model(self, path: str):
        """Save the trained model."""
        if self.model is None:
            raise ValueError("No model to save!")
        
        save_dict = {
            'model_state': self.model.state_dict(),
            'model_config': {
                'input_size': self.model.input_size,
                'hidden_size': self.model.hidden_size,
                'num_layers': self.model.num_layers,
                'use_attention': self.model.use_attention
            },
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'sequence_length': self.sequence_length,
            'training_history': self.training_history
        }
        
        torch.save(save_dict, path)
        logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load a trained model."""
        save_dict = torch.load(path, map_location=self.device)
        
        # Recreate model with saved config
        config = save_dict['model_config']
        self.model = FootballLSTM(
            input_size=config['input_size'],
            hidden_size=config['hidden_size'],
            num_layers=config['num_layers'],
            attention=config['use_attention']
        ).to(self.device)
        
        # Load model weights
        self.model.load_state_dict(save_dict['model_state'])
        
        # Load other components
        self.scaler = save_dict['scaler']
        self.feature_names = save_dict['feature_names']
        self.sequence_length = save_dict['sequence_length']
        self.training_history = save_dict.get('training_history', [])
        
        logger.info(f"Model loaded from {path}")
    
    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance using gradient-based attribution.
        
        Returns:
            Dictionary of feature importances
        """
        if self.model is None:
            raise ValueError("Model not trained!")
        
        # This would use integrated gradients or similar
        # For now, return placeholder
        return {name: np.random.random() for name in self.feature_names}


# Demo only — uses synthetic data to verify model architecture.
# For real training, use train_free_tier.py or the Pro-tier pipeline.
if __name__ == "__main__":
    print("🧠 LSTM Football Predictor Demo (SYNTHETIC DATA — not a real model)\n")
    print("=" * 50)

    # Synthetic data to test architecture — NOT for real predictions
    n_samples = 1000
    n_features = 150

    X_train = pd.DataFrame(
        np.random.randn(n_samples, n_features),
        columns=[f'feature_{i}' for i in range(n_features)]
    )
    y_train = pd.Series(np.random.randint(0, 3, n_samples))
    
    # Create predictor
    predictor = LSTMPredictor(sequence_length=10)
    
    print("\n📊 Model Architecture:")
    print(f"  • Sequence Length: 10 matches")
    print(f"  • Hidden Size: 256 neurons")
    print(f"  • Layers: 3 LSTM layers")
    print(f"  • Attention: Multi-head attention")
    print(f"  • Device: {predictor.device}")
    
    print("\n🎯 Key Features:")
    print("  • Bidirectional LSTM for better context")
    print("  • Attention mechanism for important events")
    print("  • Gradient clipping for stability")
    print("  • Early stopping to prevent overfitting")
    print("  • Confidence and uncertainty estimates")
    
    print("\n✅ LSTM Predictor Ready!")
    print("\nNext steps:")
    print("1. Load real match sequences")
    print("2. Train the model")
    print("3. Make time-aware predictions!")