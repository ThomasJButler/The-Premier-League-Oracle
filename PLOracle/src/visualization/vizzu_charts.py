# src/visualization/vizzu_charts.py

from typing import Dict, Optional
import pandas as pd
import logging
from ipyvizzu import Chart, Data, Config, Style, Animation
import colorama
from colorama import Fore, Style as ColorStyle

colorama.init()

class EPLVizualizer:
    def __init__(self):
        self.logger = self._setup_logging()
        self.color_scheme = {
            'primary': '#2E4057',
            'secondary': '#66A0E1',
            'accent': '#FF9B71',
            'win': '#28a745',
            'draw': '#ffc107',
            'loss': '#dc3545',
            'home': '#4CAF50',
            'away': '#2196F3',
            'neutral': '#757575'
        }
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('EPL_Visualizer')
        logger.setLevel(logging.INFO)
        return logger

    def create_season_comparison_chart(self, data: Dict) -> Chart:
        """Create season comparison visualization"""
        try:
            # Prepare data for Vizzu
            chart_data = {
                'Season': data['labels'],
                'Points': data['points'],
                'Goals Scored': data['goals_scored'],
                'Goals Conceded': data['goals_conceded'],
                'Metric': ['Points'] * len(data['labels']) + 
                         ['Goals Scored'] * len(data['labels']) + 
                         ['Goals Conceded'] * len(data['labels']),
                'Value': data['points'] + data['goals_scored'] + data['goals_conceded']
            }

            chart = Chart(width="100%", height="400px")
            
            # Set data
            chart.animate(
                Data.frame(pd.DataFrame(chart_data)),
                Config({
                    "x": "Season",
                    "y": "Value",
                    "color": "Metric",
                    "geometry": "line"
                }),
                Style({
                    "plot": {
                        "paddingLeft": 100,
                        "paddingRight": 100,
                        "xAxis": {
                            "label": {"angle": -45}
                        }
                    },
                    "colors": [
                        self.color_scheme['primary'],
                        self.color_scheme['win'],
                        self.color_scheme['loss']
                    ]
                })
            )

            return chart

        except Exception as e:
            self.logger.error(f"Error creating season comparison chart: {str(e)}")
            raise

    def create_form_chart(self, data: Dict) -> Chart:
        """Create form trend visualization"""
        try:
            chart_data = {
                'Match': list(range(1, len(data['form']) + 1)),
                'Result': data['form'],
                'Points': [3 if x == 'W' else 1 if x == 'D' else 0 for x in data['form']]
            }

            chart = Chart(width="100%", height="300px")
            
            chart.animate(
                Data.frame(pd.DataFrame(chart_data)),
                Config({
                    "x": "Match",
                    "y": "Points",
                    "color": "Result",
                    "geometry": "circle"
                }),
                Style({
                    "plot": {
                        "marker": {
                            "size": 20
                        }
                    },
                    "colors": [
                        self.color_scheme['win'],
                        self.color_scheme['draw'],
                        self.color_scheme['loss']
                    ]
                })
            )

            return chart

        except Exception as e:
            self.logger.error(f"Error creating form chart: {str(e)}")
            raise

    def create_home_away_comparison(self, data: Dict) -> Chart:
        """Create home/away comparison visualization"""
        try:
            chart_data = {
                'Season': data['labels'] * 2,
                'Venue': ['Home'] * len(data['labels']) + ['Away'] * len(data['labels']),
                'Points': data['home_points'] + data['away_points']
            }

            chart = Chart(width="100%", height="400px")
            
            chart.animate(
                Data.frame(pd.DataFrame(chart_data)),
                Config({
                    "x": "Season",
                    "y": "Points",
                    "color": "Venue",
                    "geometry": "column"
                }),
                Style({
                    "plot": {
                        "paddingLeft": 100,
                        "paddingRight": 100,
                        "xAxis": {
                            "label": {"angle": -45}
                        }
                    },
                    "colors": [
                        self.color_scheme['home'],
                        self.color_scheme['away']
                    ]
                })
            )

            return chart

        except Exception as e:
            self.logger.error(f"Error creating home/away comparison: {str(e)}")
            raise

    def create_scoring_distribution(self, data: Dict) -> Chart:
        """Create scoring distribution visualization"""
        try:
            chart_data = {
                'Period': data['labels'] * 2,
                'Type': ['Scored'] * len(data['labels']) + ['Conceded'] * len(data['labels']),
                'Goals': data['goals_scored'] + data['goals_conceded']
            }

            chart = Chart(width="100%", height="400px")
            
            chart.animate(
                Data.frame(pd.DataFrame(chart_data)),
                Config({
                    "x": "Period",
                    "y": "Goals",
                    "color": "Type",
                    "geometry": "column"
                }),
                Style({
                    "plot": {
                        "paddingLeft": 100,
                        "paddingRight": 100,
                        "xAxis": {
                            "label": {"angle": -45}
                        }
                    },
                    "colors": [
                        self.color_scheme['win'],
                        self.color_scheme['loss']
                    ]
                })
            )

            return chart

        except Exception as e:
            self.logger.error(f"Error creating scoring distribution: {str(e)}")
            raise

    def create_team_performance_radar(self, current_data: Dict, historical_data: Optional[Dict] = None) -> Chart:
        """Create radar chart comparing current performance to historical average"""
        try:
            metrics = [
                'Win Rate', 'Goals per Game', 'Clean Sheets',
                'Shot Accuracy', 'Points per Game', 'Goals Conceded'
            ]
            
            current_values = [
                current_data['overall']['win_percentage'],
                current_data['overall']['goals_per_game'],
                current_data['overall']['clean_sheets'],
                current_data['overall'].get('shot_accuracy', 0),
                current_data['overall']['points'] / current_data['overall']['matches_played'],
                current_data['overall']['goals_conceded_per_game']
            ]
            
            chart_data = {
                'Metric': metrics,
                'Value': current_values,
                'Type': ['Current'] * len(metrics)
            }

            if historical_data:
                historical_values = [
                    historical_data['overall']['win_percentage'],
                    historical_data['overall']['goals_per_game'],
                    historical_data['overall']['clean_sheets'],
                    historical_data['overall'].get('shot_accuracy', 0),
                    historical_data['overall']['points'] / historical_data['overall']['matches_played'],
                    historical_data['overall']['goals_conceded_per_game']
                ]
                
                chart_data['Metric'].extend(metrics)
                chart_data['Value'].extend(historical_values)
                chart_data['Type'].extend(['Historical'] * len(metrics))

            chart = Chart(width="100%", height="500px")
            
            chart.animate(
                Data.frame(pd.DataFrame(chart_data)),
                Config({
                    "angle": "Metric",
                    "radius": "Value",
                    "color": "Type",
                    "geometry": "area"
                }),
                Style({
                    "plot": {
                        "marker": {
                            "opacity": 0.7
                        }
                    },
                    "colors": [
                        self.color_scheme['primary'],
                        self.color_scheme['secondary']
                    ]
                })
            )

            return chart

        except Exception as e:
            self.logger.error(f"Error creating team performance radar: {str(e)}")
            raise

    def create_interactive_dashboard(self, team: str, data: Dict) -> None:
        """Create an interactive dashboard with multiple charts"""
        try:
            print(f"{Fore.CYAN}Creating dashboard for {team}{ColorStyle.RESET_ALL}")
            
            # Season Comparison
            season_chart = self.create_season_comparison_chart(data['season_comparison'])
            print(f"{Fore.GREEN}Season comparison chart created{ColorStyle.RESET_ALL}")
            
            # Form Chart
            form_chart = self.create_form_chart(data['form_trends'])
            print(f"{Fore.GREEN}Form trend chart created{ColorStyle.RESET_ALL}")
            
            # Home/Away Comparison
            venue_chart = self.create_home_away_comparison(data['home_away_split'])
            print(f"{Fore.GREEN}Home/Away comparison chart created{ColorStyle.RESET_ALL}")
            
            # Scoring Distribution
            scoring_chart = self.create_scoring_distribution(
                data.get('scoring_distribution', {
                    'labels': [], 
                    'goals_scored': [], 
                    'goals_conceded': []
                })
            )
            print(f"{Fore.GREEN}Scoring distribution chart created{ColorStyle.RESET_ALL}")

            return {
                'season_chart': season_chart,
                'form_chart': form_chart,
                'venue_chart': venue_chart,
                'scoring_chart': scoring_chart
            }

        except Exception as e:
            self.logger.error(f"Error creating dashboard: {str(e)}")
            raise

def create_goal_flow_chart(self, data: Dict) -> Chart:
    """Create flowing goal visualization"""
    try:
        chart = Chart(width="100%", height="400px")
        
        # Initial state
        chart.animate(
            Data.frame(pd.DataFrame(data['matches'])),
            Config({
                "x": "Match",
                "y": "Goals",
                "color": "Type",
                "geometry": "area"
            })
        )

        # Animate to stacked view
        chart.animate(
            Config({
                "x": "Match",
                "y": ["Goals", "Type"],
                "geometry": "area"
            }),
            Animation({
                "duration": 0.8,
                "easing": "cubic-in-out"
            })
        )

        return chart
    except Exception as e:
        self.logger.error(f"Error creating goal flow chart: {str(e)}")
        raise

def create_win_probability_chart(self, data: Dict) -> Chart:
    """Create win probability chart with animated transitions"""
    try:
        chart = Chart(width="100%", height="500px")
        
        # Initial state showing probabilities
        chart.animate(
            Data.frame(pd.DataFrame(data['probabilities'])),
            Config({
                "x": "Outcome",
                "y": "Probability",
                "geometry": "circle",
                "size": "Probability"
            })
        )

        # Animate to detailed view
        chart.animate(
            Config({
                "x": "Outcome",
                "y": "Probability",
                "geometry": "column",
                "label": "Probability"
            }),
            Animation({
                "duration": 1,
                "easing": "bounce"
            })
        )

        return chart
    except Exception as e:
        self.logger.error(f"Error creating win probability chart: {str(e)}")
        raise

def create_form_comparison(self, team1_data: Dict, team2_data: Dict) -> Chart:
    """Create interactive form comparison between two teams"""
    try:
        comparison_data = self._prepare_form_comparison_data(team1_data, team2_data)
        chart = Chart(width="100%", height="600px")

        # Initial view
        chart.animate(
            Data.frame(pd.DataFrame(comparison_data)),
            Config({
                "x": "Team",
                "y": "Value",
                "color": "Metric",
                "geometry": "column"
            })
        )

        # Add interactivity with multiple views
        chart.feature('tooltip', True)
        chart.feature('filter', True)
        
        # Define animation sequence
        animations = [
            {
                "config": {
                    "x": "Team",
                    "y": "Value",
                    "geometry": "column",
                    "split": True
                },
                "duration": 0.8
            },
            {
                "config": {
                    "x": ["Team", "Metric"],
                    "y": "Value",
                    "geometry": "circle"
                },
                "duration": 0.8
            }
        ]

        for anim in animations:
            chart.animate(
                Config(anim["config"]),
                Animation({"duration": anim["duration"], "easing": "cubic-in-out"})
            )

        return chart
    except Exception as e:
        self.logger.error(f"Error creating form comparison: {str(e)}")
        raise

def create_season_progress_chart(self, data: Dict) -> Chart:
    """Create animated season progress visualization"""
    try:
        chart = Chart(width="100%", height="500px")
        
        # Initial state
        chart.animate(
            Data.frame(pd.DataFrame(data['progress'])),
            Config({
                "x": "Week",
                "y": "Points",
                "color": "Team",
                "geometry": "line"
            })
        )

        # Add interactive elements
        chart.feature('tooltip', True)
        chart.feature('zoom', True)
        
        # Animate data reveal
        animations = [
            {
                "config": {
                    "x": "Week",
                    "y": "Points",
                    "geometry": "area",
                    "opacity": "Team"
                },
                "duration": 1
            },
            {
                "config": {
                    "x": "Week",
                    "y": ["Points", "Team"],
                    "geometry": "line"
                },
                "duration": 0.8
            }
        ]

        for anim in animations:
            chart.animate(
                Config(anim["config"]),
                Animation({
                    "duration": anim["duration"],
                    "easing": "cubic-in-out",
                    "delay": 0.2
                })
            )

        return chart
    except Exception as e:
        self.logger.error(f"Error creating season progress chart: {str(e)}")
        raise

def create_head_to_head_chart(self, data: Dict) -> Chart:
    """Create interactive head-to-head comparison"""
    try:
        chart = Chart(width="100%", height="500px")
        
        # Initialize with basic comparison
        chart.animate(
            Data.frame(pd.DataFrame(data['h2h'])),
            Config({
                "x": "Team",
                "y": "Value",
                "color": "Metric",
                "geometry": "column"
            })
        )

        # Add interactivity
        chart.feature('tooltip', True)
        chart.feature('filter', True)
        chart.feature('zoom', True)
        
        # Define animation sequence
        animations = [
            {
                "config": {
                    "x": "Team",
                    "y": "Value",
                    "color": "Metric",
                    "geometry": "circle",
                    "size": "Value"
                },
                "duration": 0.8
            },
            {
                "config": {
                    "x": ["Team", "Metric"],
                    "y": "Value",
                    "color": "Metric",
                    "geometry": "column"
                },
                "duration": 0.8
            }
        ]

        for anim in animations:
            chart.animate(
                Config(anim["config"]),
                Animation({
                    "duration": anim["duration"],
                    "easing": "cubic-in-out"
                })
            )

        return chart
    except Exception as e:
        self.logger.error(f"Error creating head-to-head chart: {str(e)}")
        raise

